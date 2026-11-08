import { getCandidateStages, getCandidates, getConfig, getStaffUsers, saveCandidateStages, saveConfig, getPayments, getPaymentStatuses } from '../data-store';
import type { AppConfig, CandidateStage } from '../types';
import { assignUnassignedStageTasks, getActiveStageTasks, rebalanceStageTasks } from '../staff-tasks';
import { recordApprovalLog } from './log-management';

const saveStageAssignments = (next: CandidateStage[]) => {
  const current = getCandidateStages();
  const changed = next.some((stage, index) => {
    const before = current[index];
    return before && (before.assigned_staff_id !== stage.assigned_staff_id || before.follow_up_due_at !== stage.follow_up_due_at);
  });
  if (changed) {
    saveCandidateStages(next);
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  }
};
const paymentContext = () => ({ fees: getConfig().stageFees ?? {}, statuses: getPaymentStatuses(), payments: getPayments() });

export const prepareStaffTasks = async (autoAssign = false): Promise<void> => {
  if (!autoAssign) return;
  const next = assignUnassignedStageTasks(getCandidates(), getCandidateStages(), getStaffUsers(), getConfig().staffTaskWeights, paymentContext());
  saveStageAssignments(next);
};

export const updateStaffTaskWeights = async (
  weights: Record<string, number>,
  actor: { id: string; email: string; role: string },
): Promise<AppConfig> => {
  if (actor.role !== 'superadmin') throw new Error('Only a superadmin can change staff workload settings.');
  const cleaned = Object.fromEntries(Object.entries(weights).map(([id, value]) => [id, Math.max(0, Math.min(5, Number.isFinite(value) ? value : 1))]));
  const updated = { ...getConfig(), staffTaskWeights: cleaned };
  saveConfig(updated);
  await recordApprovalLog(actor.id, actor.email, 'Config', 'staff-task-weights', 'Updated', 'Updated staff task distribution weights.');
  return updated;
};

export const rebalanceStaffTasks = async (
  weights: Record<string, number>,
  actor: { id: string; email: string; role: string },
): Promise<number> => {
  if (actor.role !== 'superadmin') throw new Error('Only a superadmin can rebalance staff tasks.');
  const next = rebalanceStageTasks(getCandidates(), getCandidateStages(), getStaffUsers(), weights, paymentContext());
  saveStageAssignments(next);
  await recordApprovalLog(actor.id, actor.email, 'Config', 'staff-task-distribution', 'Updated', 'Rebalanced active candidate stage tasks across approved staff.');
  return getActiveStageTasks(getCandidates(), next, Date.now(), paymentContext()).filter(task => task.stage.assigned_staff_id).length;
};

export const autoBalanceStaffTasks = async (actor: { id: string; email: string; role: string }): Promise<{ assigned: number; unassigned: number; changed: number }> => {
  if (actor.role !== 'superadmin' || !actor.id || !actor.email) throw new Error('Only a signed-in superadmin can auto-balance staff work.');
  const candidates = getCandidates();
  const before = getCandidateStages();
  const staff = getStaffUsers().filter(user => user.role === 'staff' && user.is_approved);
  if (!staff.length) throw new Error('There are no approved staff accounts to assign work to.');
  const saved = getConfig().staffTaskWeights ?? {};
  const weights = Object.fromEntries(staff.map(user => [user.id, saved[user.id] === 0 ? 0 : 1]));
  const next = rebalanceStageTasks(candidates, before, staff, weights, paymentContext());
  const tasks = getActiveStageTasks(candidates, next, Date.now(), paymentContext());
  const prior = new Map(before.map(stage => [stage.id, stage.assigned_staff_id]));
  const assigned = tasks.filter(task => task.stage.assigned_staff_id).length;
  const changed = tasks.filter(task => prior.get(task.stage.id) !== task.stage.assigned_staff_id).length;
  await updateStaffTaskWeights({ ...saved, ...weights }, actor);
  saveStageAssignments(next);
  await recordApprovalLog(actor.id, actor.email, 'Config', 'staff-task-distribution', 'Updated',
    `Auto-balanced active tasks: ${assigned} assigned, ${tasks.length - assigned} without an eligible owner, ${changed} assignments changed. Equal weights; paused staff and agency boundaries preserved.`);
  return { assigned, unassigned: tasks.length - assigned, changed };
};

export const assignCandidateStageTask = async (
  candidateId: string,
  stageId: number,
  staffId: string,
  actor: { id: string; email: string; role: string },
): Promise<CandidateStage> => {
  if (actor.role !== 'superadmin' || !actor.id || !actor.email) throw new Error('Only a signed-in superadmin can reassign tasks.');
  const users = getStaffUsers();
  if (!users.some(user => user.id === staffId && user.role === 'staff' && user.is_approved)) {
    throw new Error('Choose an approved staff account.');
  }
  const stages = getCandidateStages();
  const index = stages.findIndex(stage => stage.candidate_id === candidateId && stage.stage_id === stageId);
  if (index < 0) throw new Error('Candidate stage not found.');
  const owner = users.find(user => user.id === staffId)!;
  const candidate = getCandidates().find(candidate => candidate.id === candidateId);
  if (!candidate || !getActiveStageTasks([candidate], stages, Date.now(), paymentContext()).some(task => task.stage.stage_id === stageId)) {
    throw new Error('Assign the candidate’s current required stage. Earlier unpaid or unfinished stages must be handled first.');
  }
  if (owner.local_agency_id && owner.local_agency_id !== candidate?.local_agency_id) throw new Error('Choose staff from the candidate’s own local agency or an internal staff account.');
  stages[index] = { ...stages[index], assigned_staff_id: staffId, follow_up_due_at: stages[index].follow_up_due_at ?? new Date(Date.now() + 86_400_000).toISOString() };
  saveCandidateStages(stages);
  await recordApprovalLog(actor.id, actor.email, 'Candidate', candidateId, 'Updated', `Assigned stage ${stageId} task to staff ${staffId}.`);
  return stages[index];
};
