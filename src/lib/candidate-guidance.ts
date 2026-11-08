import { analyzeIntegrity, applyOverrides, SEVERITY_WEIGHT, type Finding, type IntegrityInput } from './integrity';
import { getActiveStageTasks, type StaffTask } from './staff-tasks';
import type { IntegrityOverride } from './types';

export interface CandidateGuidance {
  findings: Finding[];
  score: number;
  task?: StaffTask;
  paymentReview?: 'pending' | 'settled';
}

export const buildCandidateGuidance = (input: IntegrityInput, overrides: IntegrityOverride[] = []): Map<string, CandidateGuidance> => {
  const result = new Map<string, CandidateGuidance>(input.candidates.map(candidate => [candidate.id, { findings: [], score: 0 }]));
  applyOverrides(analyzeIntegrity(input), overrides).active.forEach(finding => {
    if (!finding.candidateId || finding.paymentId) return;
    const entry = result.get(finding.candidateId);
    if (!entry) return;
    entry.findings.push(finding);
    entry.score += SEVERITY_WEIGHT[finding.severity];
  });
  getActiveStageTasks(input.candidates, input.stages, input.now, { fees: input.stageFees ?? {}, statuses: input.paymentStatuses, payments: input.payments }).forEach(task => {
    const entry = result.get(task.candidate.id);
    if (entry) entry.task = task;
  });
  return result;
};
