import { describe, expect, it } from 'vitest';
import { analyzeIntegrity, riskScore } from '../integrity';
import type { Candidate, CandidateStage, Payment } from '../types';

const candidate = (over: Partial<Candidate>): Candidate => ({
  id: 'c1', first_name: 'A', last_name: 'B', dob: '1995-01-01', passport_number: 'EP111', tracking_code: 'T1',
  country_of_origin: 'Ethiopia', marital_status: 'Single', email: 'a@b.c', created_at: '', updated_at: '', payment_status: 'unpaid', ...over,
});
const stage = (candidate_id: string, stage_id: number, status: CandidateStage['status']): CandidateStage => ({ id: `${candidate_id}-${stage_id}`, candidate_id, stage_id, status, updated_at: '' });
const payment = (over: Partial<Payment>): Payment => ({
  id: 'p1', amount: 100, currency: 'SAR', status: 'succeeded', payer_foreign_agency_id: 'f', payee_local_agency_id: 'l', candidate_ids: ['c1'], created_at: '', updated_at: '', ...over,
});
const base = { candidates: [], stages: [], payments: [], paymentStatuses: [], medicals: [], logs: [] };

describe('analyzeIntegrity', () => {
  it('compares payment sizes within the same stage instead of treating a normal deployment fee as an outlier', () => {
    const payments = [1, 2, 3, 4, 5].map(index => payment({ id: `reg-${index}`, payer_type: 'candidate', currency: 'ETB', stage_id: 1, amount: 500 }));
    payments.push(payment({ id: 'deployment', payer_type: 'candidate', currency: 'ETB', stage_id: 4, amount: 6000 }));
    expect(analyzeIntegrity({ ...base, payments }).some(finding => finding.rule === 'payment-outlier')).toBe(false);
    payments.push(payment({ id: 'large-registration', payer_type: 'candidate', currency: 'ETB', stage_id: 1, amount: 10000 }));
    expect(analyzeIntegrity({ ...base, payments }).find(finding => finding.rule === 'payment-outlier')?.paymentId).toBe('large-registration');
  });

  it('does not confuse completed training with a passed medical stage when exams failed', () => {
    const input = { ...base, candidates: [candidate({})], stages: [stage('c1', 3, 'Completed'), stage('c1', 2, 'Failed')],
      medicals: [{ id: 'exam', candidate_id: 'c1', exam_type: 'Final Agency Medical', status: 'Failed' as const }] };
    expect(analyzeIntegrity(input).some(finding => finding.rule === 'medical-stage-failed-results')).toBe(false);
    input.stages[1].status = 'Passed';
    expect(analyzeIntegrity(input).some(finding => finding.rule === 'medical-stage-failed-results')).toBe(true);
  });
  it('flags duplicate passports and underage candidates', () => {
    const findings = analyzeIntegrity({
      ...base,
      now: Date.parse('2026-01-01'),
      candidates: [candidate({ id: 'a' }), candidate({ id: 'b', passport_number: 'ep-111' }), candidate({ id: 'c', passport_number: 'X', dob: '2012-01-01' })],
    });
    expect(findings.filter(f => f.rule === 'duplicate-passport')).toHaveLength(2);
    expect(findings.some(f => f.rule === 'underage' && f.candidateId === 'c')).toBe(true);
  });

  it('flags skipped stages, unpaid stages and deployment without medical', () => {
    const findings = analyzeIntegrity({
      ...base,
      candidates: [candidate({})],
      stages: [stage('c1', 4, 'Completed')],
      stageFees: { 4: 500 },
    });
    const rules = findings.map(f => f.rule);
    expect(rules).toContain('skipped-stage');
    expect(rules).toContain('stage-without-payment');
    expect(rules).toContain('deployed-no-medical');
  });

  it('flags reused payment references and offline payments without references', () => {
    const findings = analyzeIntegrity({
      ...base,
      payments: [payment({ id: 'p1', provider_reference: 'R1' }), payment({ id: 'p2', provider_reference: 'r1' }), payment({ id: 'p3', provider: 'manual' })],
    });
    expect(findings.filter(f => f.rule === 'duplicate-payment-reference')).toHaveLength(2);
    expect(findings.some(f => f.rule === 'manual-no-reference' && f.paymentId === 'p3')).toBe(true);
  });

  it('surfaces suspicious document and candidate image uploads for compliance review', () => {
    const findings = analyzeIntegrity({
      ...base,
      candidates: [candidate({
        profile_image_scan_report: { status: 'review', findings: ['MIME mismatch'], scanned_at: '2026-01-01T00:00:00Z' },
      })],
      documents: [{
        id: 'd1', candidate_id: 'c1', file_name: 'identity.pdf', file_type: 'application/pdf',
        storage_key: 'docs/identity.pdf', uploaded_at: '2026-01-01T00:00:00Z',
        scan_report: { status: 'review', findings: ['Active content marker'], scanned_at: '2026-01-01T00:00:00Z' },
      }],
    });
    expect(findings.map(f => f.rule)).toContain('candidate-image-review');
    expect(findings.map(f => f.rule)).toContain('document-review-flag');
  });

  it('scores a clean dataset at 100 and lowers it for findings', () => {
    expect(riskScore([])).toBe(100);
    expect(riskScore([{ id: '1', rule: 'x', severity: 'critical', title: '', detail: '' }])).toBe(75);
  });
});
