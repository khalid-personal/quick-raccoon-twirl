import { getCandidateStages, getCandidates, getConfig, getStaffUsers, saveCandidateStages, saveConfig, getPayments, getPaymentStatuses } from '../data-store';
import type { AppConfig, CandidateStage } from '../types';
import { getActiveStageTasks } from '../staff-tasks';
import { recordApprovalLog } from './log-management';
import { getApiPrincipal } from './auth';
import { balanceLocalAgencyTasks } from './local-staff-work';

const requireLocalManager = async (actor: { id: string; email: string; role: string }) => {
  const principal = await getApiPrincipal();
  if (actor.role !== 'local-agency' || principal.role !== 'local-agency' || !principal.localAgencyId || principal.id !== actor.id) {
    throw new Error('Only a signed-in local agency manager can assign or balance agency work.');
  }
  return principal;
};

const paymentContext = () => ({ fees: getConfig().stageFees ?? {}, statuses: getPaymentStatuses(), payments: getPayments() });

export const prepareStaffTasks = async (autoAssign = false): Promise<void> => {
  if (!autoAssign) return;
  await balanceLocalAgencyTasks();
};

export const updateStaffTaskWeights = async (
  weights: Record<string, number>,
  actor: { id: string; email: string; role: string },
): Promise<AppConfig> => {
  const principal = await requireLocalManager(actor);
  const eligible = new Set(getStaffUsers().filter(person => person.role === 'staff' && person.is_approved && person.local_agency_id === principal.localAgencyId).map(person => person.id));
  if (Object.keys(weights).some(id => !eligible.has(id))) throw new Error('Change workload settings only for approved staff in your own agency.');
  const cleaned = Object.fromEntries(Object.entries(weights).map(([id, value]) => [id, Math.max(0, Math.min(5, Number.isFinite(value) ? value : 1))]));
  const updated = { ...getConfig(), staffTaskWeights: { ...getConfig().staffTaskWeights, ...cleaned } };
  saveConfig(updated);
  await recordApprovalLog(actor.id, actor.email, 'Config', 'staff-task-weights', 'Updated', 'Updated staff task distribution weights.');
  return updated;
};

export const rebalanceStaffTasks = async (
  weights: Record<string, number>,
  actor: { id: string; email: string; role: string },
): Promise<number> => {
  await updateStaffTaskWeights(weights, actor);
  return (await balanceLocalAgencyTasks()).assigned;
};

export const autoBalanceStaffTasks = async (actor: { id: string; email: string; role: string }): Promise<{ assigned: number; unassigned: number; changed: number }> => {
  await requireLocalManager(actor);
  return balanceLocalAgencyTasks();
};

export const assignCandidateStageTask = async (
  candidateId: string,
  stageId: number,
  staffId: string,
  actor: { id: string; email: string; role: string },
): Promise<CandidateStage> => {
  const principal = await requireLocalManager(actor);
  const users = getStaffUsers();
  if (!users.some(user => user.id === staffId && user.role === 'staff' && user.is_approved)) {
    throw new Error('Choose an approved staff account.');
  }
  const stages = getCandidateStages();
  const index = stages.findIndex(stage => stage.candidate_id === candidateId && stage.stage_id === stageId);
  if (index < 0) throw new Error('Candidate stage not found.');
  const owner = users.find(user => user.id === staffId)!;
  const candidate = getCandidates().find(candidate => candidate.id === candidateId);
  if (principal && (principal.role !== 'local-agency' || !principal.localAgencyId || candidate?.local_agency_id !== principal.localAgencyId
    || owner.local_agency_id !== principal.localAgencyId)) {
    throw new Error('Assign only candidates and approved staff belonging to your own local agency.');
  }
  if (!candidate || !getActiveStageTasks([candidate], stages, Date.now(), paymentContext()).some(task => task.stage.stage_id === stageId)) {
    throw new Error('Assign the candidate’s current required stage. Earlier unpaid or unfinished stages must be handled first.');
  }
  if (owner.local_agency_id && owner.local_agency_id !== candidate?.local_agency_id) throw new Error('Choose staff from the candidate’s own local agency or an internal staff account.');
  stages[index] = { ...stages[index], assigned_staff_id: staffId, follow_up_due_at: stages[index].follow_up_due_at ?? new Date(Date.now() + 86_400_000).toISOString() };
  saveCandidateStages(stages);
  await recordApprovalLog(actor.id, actor.email, 'Candidate', candidateId, 'Updated', `Assigned stage ${stageId} task to staff ${staffId}.`);
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  return stages[index];
};
