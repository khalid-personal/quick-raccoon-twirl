// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { balanceLocalAgencyTasks } from '../local-staff-work';
import { assignCandidateStageTask } from '../staff-work';
import { getCandidateStages, getConfig, getPayments, saveCandidateStages, saveCandidates, saveConfig, savePayments, savePaymentStatuses, saveStaffUsers } from '../../data-store';
import { generateDemoDataset } from '../../demo-dataset';
import { getApiPrincipal } from '../auth';

vi.mock('../auth', () => ({ getApiPrincipal: vi.fn() }));
const demo = generateDemoDataset(Date.parse('2026-11-08'));
const candidates = demo.candidates.slice(0, 2).map((candidate, index) => ({ ...candidate, local_agency_id: index ? 'b' : 'a' }));
const stages = candidates.map(candidate => ({ id: `stage:${candidate.id}`, candidate_id: candidate.id, stage_id: 1, status: 'Pending' as const, updated_at: '2026-11-08' }));
const staff = [
  { id: 'manager-a', email: 'manager@a.test', role: 'local-agency' as const, is_approved: true, local_agency_id: 'a', created_at: '2026-11-08' },
  { id: 'staff-a', email: 'staff@a.test', role: 'staff' as const, is_approved: true, local_agency_id: 'a', created_at: '2026-11-08' },
  { id: 'staff-b', email: 'staff@b.test', role: 'staff' as const, is_approved: true, local_agency_id: 'b', created_at: '2026-11-08' },
];
const actor = { id: 'manager-a', email: 'manager@a.test', role: 'local-agency' };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  saveCandidates(candidates); saveCandidateStages(stages); saveStaffUsers(staff);
  saveConfig({ ...getConfig(), stageFees: {}, staffTaskWeights: {} }); savePayments([]); savePaymentStatuses([]);
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: actor.id, role: 'local-agency', localAgencyId: 'a', foreignAgencyId: null });
});
it('assigns and balances only current tasks within the authenticated manager’s agency', async () => {
  const other = structuredClone(getCandidateStages()[1]);
  const payments = getPayments();
  expect(await balanceLocalAgencyTasks()).toMatchObject({ assigned: 1, unassigned: 0 });
  expect(getCandidateStages()[0].assigned_staff_id).toBe('staff-a');
  expect(getCandidateStages()[1]).toEqual(other);
  expect(getPayments()).toEqual(payments);
  await expect(assignCandidateStageTask(candidates[1].id, 1, 'staff-a', actor)).rejects.toThrow('own local agency');
  await expect(assignCandidateStageTask(candidates[0].id, 1, 'staff-b', actor)).rejects.toThrow('own local agency');
  await expect(assignCandidateStageTask(candidates[0].id, 1, 'staff-a', actor)).resolves.toMatchObject({ assigned_staff_id: 'staff-a' });
});
it('rejects forged manager roles and keeps paused staff unassigned', async () => {
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'staff-a', role: 'staff', localAgencyId: 'a', foreignAgencyId: null });
  await expect(balanceLocalAgencyTasks()).rejects.toThrow('manager');
  await expect(assignCandidateStageTask(candidates[0].id, 1, 'staff-a', actor)).rejects.toThrow('own local agency');
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: actor.id, role: 'local-agency', localAgencyId: 'a', foreignAgencyId: null });
  saveConfig({ ...getConfig(), staffTaskWeights: { 'staff-a': 0 } });
  expect(await balanceLocalAgencyTasks()).toMatchObject({ assigned: 0, unassigned: 1 });
});
