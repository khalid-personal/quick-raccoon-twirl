import { ALL_STAGES } from './types';
import type { Candidate, CandidateStage, Payment, PaymentStatus, StaffUser } from './types';
import { stageFeeCovered } from './stage-readiness';

const DONE = new Set(['Passed', 'Issued', 'Completed']);
const DAY_MS = 86_400_000;

export interface StaffTask {
  candidate: Candidate;
  stage: CandidateStage;
  stageTitle: string;
  action: 'Start stage' | 'Follow up' | 'Resolve blocker' | 'Await payment';
  dueAt: string;
  overdue: boolean;
}

export interface StageTaskPaymentContext { fees: Record<number, number>; statuses: PaymentStatus[]; payments: Payment[] }
export const getActiveStageTasks = (candidates: Candidate[], stages: CandidateStage[], now = Date.now(), paymentContext?: StageTaskPaymentContext): StaffTask[] => {
  const stageByCandidate = new Map<string, Map<number, CandidateStage>>();
  stages.forEach(stage => {
    const own = stageByCandidate.get(stage.candidate_id) ?? new Map<number, CandidateStage>();
    own.set(stage.stage_id, stage);
    stageByCandidate.set(stage.candidate_id, own);
  });

  return candidates.flatMap(candidate => {
    const own = stageByCandidate.get(candidate.id);
    if (!own) return [];
    const active = [...ALL_STAGES].sort((a, b) => a.ordinal - b.ordinal).map(meta => ({ meta, stage: own.get(meta.id) }))
      .find(item => item.stage && (!DONE.has(item.stage.status) || paymentContext && !stageFeeCovered(candidate, item.meta.id, paymentContext.fees, paymentContext.statuses, paymentContext.payments)));
    if (!active?.stage) return [];

    const dueAt = active.stage.follow_up_due_at
      ?? new Date(new Date(active.stage.updated_at || candidate.updated_at).getTime() + DAY_MS).toISOString();
    const dueTime = new Date(dueAt).getTime();
    const action: StaffTask['action'] = paymentContext && !stageFeeCovered(candidate, active.meta.id, paymentContext.fees, paymentContext.statuses, paymentContext.payments) ? 'Await payment' : active.stage.status === 'Failed'
      ? 'Resolve blocker'
      : active.stage.status === 'In Progress' ? 'Follow up' : 'Start stage';

    return [{ candidate, stage: active.stage, stageTitle: active.meta.title, action, dueAt, overdue: Number.isFinite(dueTime) && dueTime < now }];
  }).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.candidate.tracking_code.localeCompare(b.candidate.tracking_code));
};

const eligibleStaff = (users: StaffUser[]) => users
  .filter(user => user.role === 'staff' && user.is_approved)
  .sort((a, b) => a.id.localeCompare(b.id));

export const assignUnassignedStageTasks = (
  candidates: Candidate[],
  candidateStages: CandidateStage[],
  users: StaffUser[],
  weights: Record<string, number> = {},
  paymentContext?: StageTaskPaymentContext,
): CandidateStage[] => {
  const staff = eligibleStaff(users);
  if (!staff.length) return candidateStages;

  const validIds = new Set(staff.map(user => user.id));
  const tasks = getActiveStageTasks(candidates, candidateStages, Date.now(), paymentContext);
  const taskStageIds = new Set(tasks.map(task => task.stage.id));
  const loads = new Map(staff.map(user => [user.id, 0]));
  candidateStages.forEach(stage => {
    if (taskStageIds.has(stage.id) && stage.assigned_staff_id && validIds.has(stage.assigned_staff_id)) {
      loads.set(stage.assigned_staff_id, (loads.get(stage.assigned_staff_id) ?? 0) + 1);
    }
  });

  const assignable = staff.filter(user => Math.max(0, weights[user.id] ?? 1) > 0);
  const recipients = assignable;
  const agencyOf = new Map(candidates.map(candidate => [candidate.id, candidate.local_agency_id]));
  // Never route a local agency's work into a different local agency.
  const poolFor = (candidateId: string) => {
    const agencyId = agencyOf.get(candidateId);
    const own = agencyId ? recipients.filter(user => user.local_agency_id === agencyId) : [];
    if (own.length) return own;
    const internal = recipients.filter(user => !user.local_agency_id);
    return internal;
  };
  return candidateStages.map(stage => {
    if (!taskStageIds.has(stage.id)) return stage;
    if (stage.assigned_staff_id && validIds.has(stage.assigned_staff_id)) {
      return stage.follow_up_due_at ? stage : { ...stage, follow_up_due_at: new Date(Date.now() + DAY_MS).toISOString() };
    }
    const pool = poolFor(stage.candidate_id);
    if (!pool.length) return { ...stage, assigned_staff_id: undefined };
    const recipient = pool.reduce((best, user) => {
      const userWeight = weights[user.id] ?? 1;
      const bestWeight = weights[best.id] ?? 1;
      const userLoad = (loads.get(user.id) ?? 0) / userWeight;
      const bestLoad = (loads.get(best.id) ?? 0) / bestWeight;
      return userLoad < bestLoad ? user : best;
    });
    loads.set(recipient.id, (loads.get(recipient.id) ?? 0) + 1);
    return {
      ...stage,
      assigned_staff_id: recipient.id,
      follow_up_due_at: stage.follow_up_due_at ?? new Date(Date.now() + DAY_MS).toISOString(),
    };
  });
};

export const rebalanceStageTasks = (
  candidates: Candidate[],
  candidateStages: CandidateStage[],
  users: StaffUser[],
  weights: Record<string, number> = {},
  paymentContext?: StageTaskPaymentContext,
): CandidateStage[] => {
  const tasks = getActiveStageTasks(candidates, candidateStages, Date.now(), paymentContext);
  const taskIds = new Set(tasks.map(task => task.stage.id));
  const cleared = candidateStages.map(stage => taskIds.has(stage.id) ? { ...stage, assigned_staff_id: undefined } : stage);
  return assignUnassignedStageTasks(candidates, cleared, users, weights, paymentContext);
};
