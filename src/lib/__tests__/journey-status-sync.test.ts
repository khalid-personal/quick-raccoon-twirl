// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { LS_APPROVAL_LOGS, LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_MEDICAL_RESULTS } from '../data-keys';
const backend = vi.hoisted(() => ({ read: vi.fn(), upsert: vi.fn(), update: vi.fn(), demo: false }));
vi.mock('../supabase', () => ({ supabase: { from: (table: string) => ({
  select: () => ({ range: () => backend.read(table) }), upsert: () => backend.upsert(table),
  update: (payload: unknown) => ({ eq: (_column: string, id: string) => ({ select: () => ({ maybeSingle: () => backend.update(table, id, payload) }) }) }),
}) } }));
vi.mock('../demo-mode', () => ({ isDemoMode: () => backend.demo }));
import { flushSupabaseSync, refreshJourneyFromSupabase } from '../supabase-sync';

beforeEach(() => {
  localStorage.clear();
  backend.demo = false;
  backend.read.mockReset();
  backend.upsert.mockReset();
  backend.update.mockReset();
  vi.stubEnv('VITE_USE_LOCAL_MOCK', 'false');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it('reflects backend clearance without completing an unfinished local stage or writing to the server', async () => {
  backend.read.mockImplementation(async (table: string) => ({ data: [{ id: table === 'candidates' ? 'person' : table === 'approval_logs' ? 'event' : 'stage', data: table === 'candidates' ? { clearance: { labour_ministry: { status: 'cleared' } } } : table === 'approval_logs' ? { description: 'Ministry response recorded' } : { candidate_id: 'person', status: 'Pending' } }], error: null }));
  const changed = vi.fn(); window.addEventListener('supabase-data-changed', changed);
  await refreshJourneyFromSupabase();
  expect(JSON.parse(localStorage.getItem(LS_CANDIDATES)!)[0].clearance.labour_ministry.status).toBe('cleared');
  expect(JSON.parse(localStorage.getItem(LS_CANDIDATE_STAGES)!)[0].status).toBe('Pending');
  expect(JSON.parse(localStorage.getItem(LS_APPROVAL_LOGS)!)[0].description).toBe('Ministry response recorded');
  expect(changed).toHaveBeenCalledOnce();
  window.removeEventListener('supabase-data-changed', changed);
});
it('preserves both caches if one backend read fails', async () => {
  localStorage.setItem(LS_CANDIDATES, 'original');
  backend.read.mockImplementation(async (table: string) => ({ data: [], error: table === 'candidate_stages' ? new Error('Access denied') : null }));
  await expect(refreshJourneyFromSupabase()).rejects.toThrow('Access denied');
  expect(localStorage.getItem(LS_CANDIDATES)).toBe('original');
});
it('refreshes medical locations with stages and rolls back all collections if storage fails', async () => {
  const keys = [LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_MEDICAL_RESULTS, LS_APPROVAL_LOGS];
  keys.forEach(key => localStorage.setItem(key, 'original'));
  backend.read.mockImplementation(async (table: string) => ({ data: [{ id: table, data: table === 'medical_results' ? { location: { name: 'Source clinic', city: 'Adama' } } : {} }], error: null }));
  const setItem = Storage.prototype.setItem;
  let failed = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === LS_MEDICAL_RESULTS && !failed) { failed = true; throw new DOMException('Quota exceeded', 'QuotaExceededError'); }
    setItem.call(this, key, value);
  });
  await expect(refreshJourneyFromSupabase()).rejects.toThrow('Quota exceeded');
  expect(keys.map(key => localStorage.getItem(key))).toEqual(keys.map(() => 'original'));
  await refreshJourneyFromSupabase();
  expect(JSON.parse(localStorage.getItem(LS_MEDICAL_RESULTS)!)[0].location.name).toBe('Source clinic');
});
it('does not replace edits made during a read, and does not apply an abandoned session', async () => {
  backend.read.mockImplementation(async () => { localStorage.setItem(LS_CANDIDATES, 'new edit'); return { data: [], error: null }; });
  await expect(refreshJourneyFromSupabase()).rejects.toThrow('changed during refresh');
  expect(localStorage.getItem(LS_CANDIDATES)).toBe('new edit');
  await refreshJourneyFromSupabase(() => false);
  expect(localStorage.getItem(LS_CANDIDATES)).toBe('new edit');
});
it('never queries the backend in demo or local-only mode', async () => {
  backend.demo = true;
  await refreshJourneyFromSupabase();
  backend.demo = false; vi.stubEnv('VITE_USE_LOCAL_MOCK', 'true');
  await refreshJourneyFromSupabase();
  expect(backend.read).not.toHaveBeenCalled();
});
it('preserves unsynced journey edits until the latest write is confirmed', async () => {
  localStorage.setItem(LS_CANDIDATES, 'edited');
  backend.read.mockResolvedValue({ data: [{ id: 'person', data: { id: 'person', note: 'before' } }], error: null });
  let finish: (value: { error: { message: string } }) => void = () => { throw new Error('Write has not started'); };
  backend.update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = flushSupabaseSync('candidates', [{ id: 'person' }]);
  await Promise.resolve();
  await expect(refreshJourneyFromSupabase()).rejects.toThrow('awaiting backend confirmation');
  finish({ error: { message: 'Write failed' } });
  expect(await pending).toBe('Write failed');
  await expect(refreshJourneyFromSupabase()).rejects.toThrow('awaiting backend confirmation');
  expect(localStorage.getItem(LS_CANDIDATES)).toBe('edited');
  backend.update.mockResolvedValue({ data: { id: 'person' }, error: null });
  expect(await flushSupabaseSync('candidates', [{ id: 'person' }])).toBeNull();
  backend.read.mockResolvedValue({ data: [], error: null });
  await refreshJourneyFromSupabase();
  expect(localStorage.getItem(LS_CANDIDATES)).toBe('[]');
});
it('updates operational metadata without inserting or deleting ministry-owned source rows', async () => {
  backend.read.mockResolvedValue({ data: [{ id: 'stage', data: { id: 'stage', assigned_staff_id: 'before' } }, { id: 'other', data: { id: 'other' } }], error: null });
  backend.update.mockResolvedValue({ data: { id: 'stage' }, error: null });
  expect(await flushSupabaseSync('candidate_stages', [{ id: 'stage', assigned_staff_id: 'operator' }])).toBeNull();
  expect(backend.update).toHaveBeenCalledWith('candidate_stages', 'stage', { data: { id: 'stage', assigned_staff_id: 'operator' } });
  expect(backend.upsert).not.toHaveBeenCalled();
});
it('rejects client creation, medical writes and inaccessible source updates explicitly', async () => {
  backend.read.mockResolvedValue({ data: [], error: null });
  expect(await flushSupabaseSync('candidate_stages', [{ id: 'new' }])).toContain('must come from the ministry');
  expect(await flushSupabaseSync('medical_results', [])).toContain('read-only');
  backend.read.mockResolvedValue({ data: [{ id: 'stage', data: { id: 'stage', assigned_staff_id: 'before' } }], error: null });
  backend.update.mockResolvedValue({ data: null, error: null });
  expect(await flushSupabaseSync('candidate_stages', [{ id: 'stage', assigned_staff_id: 'operator' }])).toContain('could not be updated');
  backend.update.mockResolvedValue({ data: { id: 'stage' }, error: null });
  expect(await flushSupabaseSync('candidate_stages', [{ id: 'stage', assigned_staff_id: 'operator' }])).toBeNull();
});
