import { getApiPrincipal } from './auth';
import { getCandidates, getCandidateStages, getConfig, getPayments, getPaymentStatuses, getStaffUsers, saveCandidateStages } from '../data-store';
import { getActiveStageTasks, rebalanceStageTasks } from '../staff-tasks';
import { recordApprovalLog } from './log-management';

export async function balanceLocalAgencyTasks() {
  const principal = await getApiPrincipal();
  if (principal.role !== 'local-agency' || !principal.localAgencyId) throw new Error('A signed-in local agency manager is required.');
  const candidates = getCandidates().filter(candidate => candidate.local_agency_id === principal.localAgencyId);
  const staff = getStaffUsers().filter(person => person.role === 'staff' && person.is_approved && person.local_agency_id === principal.localAgencyId);
  if (!staff.length) throw new Error('Approve staff in your own agency before assigning work.');
  const before = getCandidateStages();
  const context = { fees: getConfig().stageFees ?? {}, payments: getPayments(), statuses: getPaymentStatuses() };
  const after = rebalanceStageTasks(candidates, before, staff, getConfig().staffTaskWeights ?? {}, context);
  const tasks = getActiveStageTasks(candidates, after, Date.now(), context);
  saveCandidateStages(after);
  await recordApprovalLog(principal.id, getStaffUsers().find(person => person.id === principal.id)?.email ?? principal.id,
    'Config', `local-task-distribution:${principal.localAgencyId}`, 'Updated', `Balanced ${tasks.length} current candidate tasks within the local agency. Other agencies, completed stages and payments were not changed.`);
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  return { assigned: tasks.filter(task => task.stage.assigned_staff_id).length, unassigned: tasks.filter(task => !task.stage.assigned_staff_id).length,
    changed: after.filter(stage => before.find(item => item.id === stage.id)?.assigned_staff_id !== stage.assigned_staff_id).length };
}
