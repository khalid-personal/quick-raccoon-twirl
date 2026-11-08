import { v4 as uuidv4 } from 'uuid';
import { ALL_STAGES, type CandidateStage, type Candidate, type Payment, type PaymentStatus, type StageStatus } from './types';
import { stageFeeCovered } from './stage-readiness';

const INITIAL_STATUS: StageStatus = 'Pending';
export const isStageComplete = (status: StageStatus): boolean => ['Passed', 'Issued', 'Completed'].includes(status);

export const enforceStageContinuity = (stages: CandidateStage[], updatedAt = new Date().toISOString()): CandidateStage[] => {
  const byCandidate = new Map<string, CandidateStage[]>();
  stages.forEach(stage => byCandidate.set(stage.candidate_id, [...(byCandidate.get(stage.candidate_id) ?? []), stage]));
  const reset = new Set<string>();
  byCandidate.forEach(own => {
    let blocked = false;
    ALL_STAGES.forEach(meta => {
      const stage = own.find(stage => stage.stage_id === meta.id);
      if (blocked && stage && stage.status !== 'Pending') reset.add(stage.id);
      if (!stage || !isStageComplete(stage.status)) blocked = true;
    });
  });
  return stages.map(stage => reset.has(stage.id) ? { ...stage, status: 'Pending', date: undefined, updated_at: updatedAt } : stage);
};

export const normalizeCandidateStages = (stages: CandidateStage[], candidates: Candidate[]): CandidateStage[] => {
  const candidateIds = [...new Set([...candidates.map(candidate => candidate.id), ...stages.map(stage => stage.candidate_id)])];
  const latest = new Map<string, CandidateStage>();
  stages.forEach(record => {
    const key = `${record.candidate_id}:${record.stage_id}`;
    const previous = latest.get(key);
    if (!previous || record.updated_at.localeCompare(previous.updated_at) > 0) latest.set(key, record);
  });

  return candidateIds.flatMap(candidateId => ALL_STAGES.map(stage => {
    const existing = latest.get(`${candidateId}:${stage.id}`);
    return existing
      ? { ...existing }
      : {
          id: uuidv4(),
          candidate_id: candidateId,
          stage_id: stage.id,
          status: INITIAL_STATUS,
          updated_at: new Date().toISOString(),
        };
  }));
};

export const revertUnpaidCompletedStages = (
  stages: CandidateStage[],
  paymentStatuses: PaymentStatus[],
  stageFees: Record<number, number>,
  updatedAt = new Date().toISOString(),
  evidence?: { candidates: Candidate[]; payments: Payment[] },
): CandidateStage[] => stages.map(candidateStage => {
  const stage = ALL_STAGES.find(item => item.id === candidateStage.stage_id);
  if (!stage || !['Passed', 'Issued', 'Completed'].includes(candidateStage.status)) return candidateStage;

  const fee = stageFees[stage.id] ?? stage.fee_amount ?? 0;
  const candidate = evidence?.candidates.find(candidate => candidate.id === candidateStage.candidate_id);
  const isPaid = candidate && evidence ? stageFeeCovered(candidate, stage.id, stageFees, paymentStatuses, evidence.payments) : paymentStatuses.some(payment =>
    payment.candidateId === candidateStage.candidate_id && payment.stageId === stage.id && payment.isPaid,
  );
  if (fee <= 0 || isPaid) return candidateStage;

  return {
    ...candidateStage,
    status: 'In Progress',
    date: undefined,
    updated_at: updatedAt,
  };
});
