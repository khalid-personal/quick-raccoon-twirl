// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoBalanceStaffTasks } from '../staff-work';
import { demoConfigPatch, generateDemoDataset } from '../../demo-dataset';
import { getApprovalLogs, getCandidateStages, getConfig, getPayments, getPaymentStatuses, saveCandidateStages, saveCandidates, saveConfig, savePayments, savePaymentStatuses, saveStaffUsers } from '../../data-store';
import { getActiveStageTasks } from '../../staff-tasks';
import { getApiPrincipal } from '../auth';
vi.mock('../auth', () => ({ getApiPrincipal: vi.fn() }));

const actor = { id: 'local-manager', email: 'manager@example.test', role: 'local-agency' };
const demo = generateDemoDataset(Date.parse('2026-11-07'), 'high-performing');
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: actor.id, role: 'local-agency', localAgencyId: demo.localAgencies[0].id, foreignAgencyId: null });
});
describe('persistent agency-owned workload balancing', () => {
  it('balances only the authenticated agency without changing other agencies, completed work, payments or deadlines', async () => {
    const candidates = demo.candidates.slice(0, 40);
    const ids = new Set(candidates.map(candidate => candidate.id));
    const staff = demo.staffUsers.filter(user => user.role === 'staff');
    const paused = staff[0].id;
    saveConfig({ ...demoConfigPatch(getConfig(), demo), staffTaskWeights: { [paused]: 0 } });
    saveCandidates(candidates); saveStaffUsers(staff);
    savePayments(demo.payments.filter(payment => payment.candidate_ids.some(id => ids.has(id))));
    savePaymentStatuses(demo.paymentStatuses.filter(payment => ids.has(payment.candidateId)));
    saveCandidateStages(demo.stages.filter(stage => ids.has(stage.candidate_id)));
    const before = getCandidateStages();
    const payments = getPayments(), statuses = getPaymentStatuses();
    const completed = before.filter(stage => ['Completed', 'Passed', 'Issued'].includes(stage.status));
    const result = await autoBalanceStaffTasks(actor);
    const after = getCandidateStages(), tasks = getActiveStageTasks(candidates.filter(candidate => candidate.local_agency_id === demo.localAgencies[0].id), after);
    expect(result.assigned + result.unassigned).toBe(tasks.length);
    expect(result.assigned).toBe(tasks.length);
    expect(tasks.some(task => task.stage.assigned_staff_id === paused)).toBe(false);
    tasks.forEach(task => expect(staff.find(user => user.id === task.stage.assigned_staff_id)?.local_agency_id).toBe(task.candidate.local_agency_id));
    for (const agency of demo.localAgencies.slice(0, 1)) {
      const eligible = staff.filter(user => user.local_agency_id === agency.id && user.id !== paused);
      const counts = eligible.map(user => tasks.filter(task => task.stage.assigned_staff_id === user.id).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
    completed.forEach(stage => expect(after.find(item => item.id === stage.id)).toEqual(stage));
    before.filter(stage => candidates.find(candidate => candidate.id === stage.candidate_id)?.local_agency_id !== demo.localAgencies[0].id)
      .forEach(stage => expect(after.find(item => item.id === stage.id)).toEqual(stage));
    before.filter(stage => stage.follow_up_due_at).forEach(stage => expect(after.find(item => item.id === stage.id)?.follow_up_due_at).toBe(stage.follow_up_due_at));
    expect(getPayments()).toEqual(payments); expect(getPaymentStatuses()).toEqual(statuses);
    expect(getConfig().staffTaskWeights?.[paused]).toBe(0);
    expect(getApprovalLogs().some(log => log.description.includes('within the local agency'))).toBe(true);
  });
  it('rejects unauthorized callers and missing approved staff explicitly', async () => {
    await expect(autoBalanceStaffTasks({ ...actor, role: 'staff' })).rejects.toThrow('local agency manager');
    await expect(autoBalanceStaffTasks({ ...actor, role: 'superadmin' })).rejects.toThrow('local agency manager');
    await expect(autoBalanceStaffTasks(actor)).rejects.toThrow('Approve staff');
  });
});
