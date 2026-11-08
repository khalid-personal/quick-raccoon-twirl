import { describe, expect, it } from 'vitest';
import { buildCandidateGuidance } from '../candidate-guidance';
import { generateDemoDataset } from '../demo-dataset';
import type { IntegrityInput } from '../integrity';

const candidate = { ...generateDemoDataset(Date.parse('2026-11-07')).candidates[0], id: 'c1', passport_number: 'P1', phone_number: undefined, arrival: undefined, visa: undefined, clearance: undefined, profile_image_scan_report: undefined, passport_image_scan_report: undefined };
const input: IntegrityInput = {
  candidates: [candidate], stages: [1, 3, 2, 4].map(id => ({ id: `s${id}`, candidate_id: 'c1', stage_id: id, status: id === 1 ? 'In Progress' : 'Pending', updated_at: '2026-01-01', follow_up_due_at: '2026-01-02' })),
  payments: [], paymentStatuses: [], medicals: [], logs: [], now: Date.parse('2026-11-07'),
};
describe('candidate integrity and task guidance', () => {
  it('finds the actual first unfinished canonical stage and its overdue follow-up', () => {
    const row = buildCandidateGuidance(input).get('c1')!;
    expect(row.task).toMatchObject({ stage: { stage_id: 1 }, stageTitle: 'Registration', overdue: true });
    expect(row.findings.some(finding => finding.rule === 'stale-stage')).toBe(true);
    expect(row.findings.every(finding => finding.candidateId === 'c1' && !finding.paymentId)).toBe(true);
    const next = buildCandidateGuidance({ ...input, stages: input.stages.map(stage => stage.stage_id === 1 ? { ...stage, status: 'Completed' } : stage) }).get('c1')!;
    expect(next.task?.stage.stage_id).toBe(3);
  });
  it('honors resolved integrity overrides and excludes transaction-only findings', () => {
    const row = buildCandidateGuidance(input).get('c1')!;
    const override = row.findings.find(finding => finding.rule === 'stale-stage')!;
    const revised = buildCandidateGuidance(input, [{ id: override.id, finding_id: override.id, rule: override.rule, severity: override.severity, title: override.title, reason: 'Checked', overridden_at: '2026-11-07', overridden_by_id: 'admin', overridden_by_email: 'admin@example.test' }]).get('c1')!;
    expect(revised.findings.some(finding => finding.id === override.id)).toBe(false);
    expect(revised.score).toBeLessThan(row.score);
  });
});
