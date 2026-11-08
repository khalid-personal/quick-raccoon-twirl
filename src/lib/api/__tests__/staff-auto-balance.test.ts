// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { autoBalanceStaffTasks } from '../staff-work';
import { demoConfigPatch, generateDemoDataset } from '../../demo-dataset';
import { getApprovalLogs, getCandidateStages, getConfig, getPayments, getPaymentStatuses, saveCandidateStages, saveCandidates, saveConfig, savePayments, savePaymentStatuses, saveStaffUsers } from '../../data-store';
import { getActiveStageTasks } from '../../staff-tasks';

const actor = { id: 'superadmin', email: 'superadmin@example.test', role: 'superadmin' };
const demo = generateDemoDataset(Date.parse('2026-11-07'), 'high-performing');
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
});
describe('persistent all-agency workload balancing', () => {
  it('balances eligible staff in every agency without changing completed work, payments or deadlines', async () => {
    const candidates = demo.candidates.slice(0, 40);
    const ids = new Set(candidates.map(candidate => candidate.id));
    const staff = demo.staffUsers.filter(user => user.role === 'staff');
    const paused = staff[0].id;
    saveConfig({ ...demoConfigPatch(getConfig(), demo), staffTaskWeights: { [paused]: 0, [staff[1].id]: 4 } });
    saveCandidates(candidates); saveStaffUsers(staff);
    savePayments(demo.payments.filter(payment => payment.candidate_ids.some(id => ids.has(id))));
    savePaymentStatuses(demo.paymentStatuses.filter(payment => ids.has(payment.candidateId)));
    saveCandidateStages(demo.stages.filter(stage => ids.has(stage.candidate_id)));
    const before = getCandidateStages();
    const payments = getPayments(), statuses = getPaymentStatuses();
    const completed = before.filter(stage => ['Completed', 'Passed', 'Issued'].includes(stage.status));
    const result = await autoBalanceStaffTasks(actor);
    const after = getCandidateStages(), tasks = getActiveStageTasks(candidates, after);
    expect(result.assigned + result.unassigned).toBe(tasks.length);
    expect(result.assigned).toBe(tasks.length);
    expect(tasks.some(task => task.stage.assigned_staff_id === paused)).toBe(false);
    tasks.forEach(task => expect(staff.find(user => user.id === task.stage.assigned_staff_id)?.local_agency_id).toBe(task.candidate.local_agency_id));
    for (const agency of demo.localAgencies) {
      const eligible = staff.filter(user => user.local_agency_id === agency.id && user.id !== paused);
      const counts = eligible.map(user => tasks.filter(task => task.stage.assigned_staff_id === user.id).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
    completed.forEach(stage => expect(after.find(item => item.id === stage.id)).toEqual(stage));
    before.filter(stage => stage.follow_up_due_at).forEach(stage => expect(after.find(item => item.id === stage.id)?.follow_up_due_at).toBe(stage.follow_up_due_at));
    expect(getPayments()).toEqual(payments); expect(getPaymentStatuses()).toEqual(statuses);
    expect(getConfig().staffTaskWeights?.[paused]).toBe(0);
    expect(getApprovalLogs().some(log => log.description.includes('Auto-balanced active tasks'))).toBe(true);
  });
  it('rejects unauthorized callers and missing approved staff explicitly', async () => {
    await expect(autoBalanceStaffTasks({ ...actor, role: 'staff' })).rejects.toThrow('signed-in superadmin');
    await expect(autoBalanceStaffTasks(actor)).rejects.toThrow('no approved staff');
  });
});
