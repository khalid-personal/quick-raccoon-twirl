import { ALL_STAGES, type Candidate, type CandidateStage, type Payment, type PaymentStatus, type StaffUser } from './types';
import { stageFeeCovered, stageIsComplete } from './stage-readiness';

export interface ForeignStaffTask {
  candidate: Candidate;
  stage: CandidateStage;
  stageTitle: string;
  action: 'Awaiting payment' | 'Resolve blocker' | 'Follow up' | 'Start stage';
}

export function foreignAgencyTasks(
  agencyId: string, candidates: Candidate[], stages: CandidateStage[], fees: Record<number, number>,
  statuses: PaymentStatus[], payments: Payment[],
): ForeignStaffTask[] {
  const ordered = [...ALL_STAGES].sort((a, b) => a.ordinal - b.ordinal);
  const byCandidate = new Map<string, Map<number, CandidateStage>>();
  for (const stage of stages) {
    const own = byCandidate.get(stage.candidate_id) ?? new Map<number, CandidateStage>();
    own.set(stage.stage_id, stage);
    byCandidate.set(stage.candidate_id, own);
  }
  return candidates.filter(candidate => candidate.foreign_agency_id === agencyId).flatMap(candidate => {
    const own = byCandidate.get(candidate.id);
    for (const meta of ordered) {
      const stage = own?.get(meta.id);
      if (!stage) return [];
      const paid = stageFeeCovered(candidate, meta.id, fees, statuses, payments);
      if (stageIsComplete(stage.status) && paid) continue;
      const action = !paid ? 'Awaiting payment'
        : stage.status === 'Failed' ? 'Resolve blocker'
          : stage.status === 'In Progress' ? 'Follow up' : 'Start stage';
      return [{ candidate, stage, stageTitle: meta.title, action } satisfies ForeignStaffTask];
    }
    return [];
  }).sort((a, b) => a.candidate.tracking_code.localeCompare(b.candidate.tracking_code));
}

export const foreignAgencyStaff = (agencyId: string, users: StaffUser[]): StaffUser[] =>
  users.filter(user => user.role === 'foreign-agency-staff' && user.is_approved && user.foreign_agency_id === agencyId)
    .sort((a, b) => a.id.localeCompare(b.id));

export function balanceForeignTasks(tasks: ForeignStaffTask[], stages: CandidateStage[], users: StaffUser[]): CandidateStage[] {
  if (!users.length) return stages;
  const assignments = new Map(tasks.map((task, index) => [task.stage.id, users[index % users.length].id]));
  return stages.map(stage => assignments.has(stage.id)
    ? { ...stage, foreign_assigned_staff_id: assignments.get(stage.id) }
    : stage);
}
