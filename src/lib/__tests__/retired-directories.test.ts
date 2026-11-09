// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { getCandidates, getConfig, getCocFacilities, getForeignAgencies, getLocalAgencies, getPayments, getApprovalLogs, initializeDataStore } from '../data-store';
import { LS_CANDIDATES, LS_COC_FACILITIES, LS_CONFIG, LS_DISABLE_SEED, LS_FOREIGN_AGENCIES, LS_LOCAL_AGENCIES, LS_PAYMENTS } from '../data-keys';
import { DEMO_KEY_PREFIX } from '../demo-mode';
import { SEED_CONFIG } from '../seed/config';
import { generateDemoDataset } from '../demo-dataset';
import { isRetiredDirectoryEntry } from '../retired-directories';

const entry = (name: string, id = name) => ({ id, name, created_at: '2026-01-01' });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
it.each([false, true])('retires only named placeholders in practice=%s while preserving records and historical references', practice => {
  if (practice) sessionStorage.setItem('dawm_demo_session', '1');
  const prefix = practice ? DEMO_KEY_PREFIX : '';
  const locals = [entry('NuraLink', 'retired-local'), ...['X', 'Y', 'Z'].map(letter => entry(`Local Agency ${letter}`)), entry('Ministry local partner')];
  const foreigns = ['Al-Aman Recruitment', 'Gulf Manpower Solutions', 'Asia Star Agency', 'Middle East Connect', 'Ministry foreign partner'].map(name => entry(name));
  const centers = ['A', 'B', 'C', 'D'].map(letter => entry(`COC Training Center ${letter}`));
  centers.push(entry('Ministry assessment center'));
  const candidate = { ...generateDemoDataset(Date.parse('2026-11-08')).candidates[0], local_agency_id: 'retired-local', foreign_agency_id: foreigns[0].id };
  const payment = { id: 'old-payment', amount: 100, payee_local_agency_id: 'retired-local', candidate_ids: [candidate.id] };
  const config = { ...SEED_CONFIG, localAgencies: locals, foreignAgencies: foreigns, cocFacilities: centers, agencyPartnerships: [{ local_agency_id: 'retired-local', foreign_agency_id: foreigns[0].id, status: 'active', started_at: '' }] };
  for (const [key, value] of [[LS_LOCAL_AGENCIES, locals], [LS_FOREIGN_AGENCIES, foreigns], [LS_COC_FACILITIES, centers], [LS_CONFIG, config], [LS_CANDIDATES, [candidate]], [LS_PAYMENTS, [payment]]]) {
    localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
  }
  localStorage.setItem(`${prefix}${LS_DISABLE_SEED}`, 'true');
  const candidatesBefore = getCandidates();
  initializeDataStore();
  expect(getLocalAgencies().map(item => item.name)).toEqual(['Ministry local partner']);
  expect(getForeignAgencies().map(item => item.name)).toEqual(['Ministry foreign partner']);
  expect(getCocFacilities().map(item => item.name)).toEqual(['Ministry assessment center']);
  expect(getConfig().agencyPartnerships).toEqual([]);
  expect(getCandidates()).toEqual(candidatesBefore);
  expect(getPayments()).toEqual([payment]);
  expect(JSON.parse(localStorage.getItem(`${prefix}${LS_LOCAL_AGENCIES}`)!)).toEqual([locals.at(-1)]);
  expect(getApprovalLogs()).toHaveLength(4);
  initializeDataStore();
  expect(getApprovalLogs()).toHaveLength(4);
});
it('never reintroduces the deleted entries in fresh seeds or any generated practice scenario', () => {
  expect([...SEED_CONFIG.cocFacilities, ...SEED_CONFIG.localAgencies, ...SEED_CONFIG.foreignAgencies].some(isRetiredDirectoryEntry)).toBe(false);
  for (const scenario of ['priority', 'needs-attention', 'high-performing'] as const) {
    const data = generateDemoDataset(Date.parse('2026-11-08'), scenario);
    expect([...data.cocFacilities, ...data.localAgencies, ...data.foreignAgencies].some(isRetiredDirectoryEntry)).toBe(false);
    expect(data.candidates.length).toBeGreaterThan(400);
  }
});
