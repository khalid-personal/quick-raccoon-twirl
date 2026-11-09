import { describe, expect, it } from 'vitest';
import { activityCategory, activityHighlights, presentActivity } from '../activity-presentation';

const snapshot = {
  payment: { id: 'payment', amount: 9000, currency: 'ETB', candidate_ids: ['candidate'],
    provider_reference: 'BANK-1', payee_local_agency_id: 'agency',
    demo_evidence: { identities: [{ name: 'Samuel Jemal', tracking_code: 'TRK-4' }] } },
  line: { amount: 7200, currency: 'ETB' },
};

describe('human-readable activity', () => {
  it('separates real progress, ministry checks, uploads and agency actions from payment reviews', () => {
    expect(activityCategory('Ministry clearance response recorded')).toBe('Journey & ministry');
    expect(activityCategory('Stage 3 completed')).toBe('Journey & ministry');
    expect(activityCategory('Receipt checked against bank statement')).toBe('Payments');
    expect(activityCategory('Passport document uploaded')).toBe('Documents');
    expect(activityCategory('Agency appeal submitted')).toBe('Agency decisions');
    expect(activityCategory('Candidate registered')).toBe('Accounts & records');
    expect(activityCategory('Receipt verified. Snapshot: {"candidate":{"training":"complete"}}')).toBe('Payments');
  });
  it('keeps different recorded topics visible without inventing events or changing their chronological order', () => {
    const items = [...Array.from({ length: 20 }, (_, id) => ({ id, description: 'Payment review recorded' })),
      { id: 20, description: 'Candidate registered' }, { id: 21, description: 'Ministry status response recorded' }];
    const highlights = activityHighlights(items);
    expect(highlights).toHaveLength(12);
    expect(highlights.map(item => item.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21]);
    expect(activityHighlights(items.slice(0, 3))).toEqual(items.slice(0, 3));
  });
  it('explains a historical underpayment using saved candidate, amounts and reference, not JSON', () => {
    const description = `Amount discrepancy escalation requested: underpayment, bank. Reason: DEMO ONLY scenario practice. Follow-up: 2026-11-11. Snapshot: ${JSON.stringify(snapshot)}`;
    const result = presentActivity(description, 'Updated');
    expect(result.title).toBe('A payment shortfall needs review');
    expect(result.summary).toContain('lower than the receipt');
    expect(result.practice).toBe(true);
    expect(result.facts).toEqual(expect.arrayContaining([
      { label: 'Candidate', value: 'Samuel Jemal (TRK-4)' },
      { label: 'Payment reference', value: 'BANK-1' },
      { label: 'Amount short', value: '1,800 ETB' },
      { label: 'Follow-up date', value: '2026-11-11' },
    ]));
    expect(result.summary).not.toContain('{"');
  });
  it('distinguishes overpayment from a shortfall without implying proven fault or suspension', () => {
    const result = presentActivity(`Amount discrepancy escalation requested: overpayment, bank. Snapshot: ${JSON.stringify({ ...snapshot, line: { amount: 10800, currency: 'ETB' } })}`, 'Updated');
    expect(result.title).toBe('An extra payment amount needs review');
    expect(result.facts).toContainEqual({ label: 'Extra amount', value: '1,800 ETB' });
    expect(result.summary).not.toMatch(/paused|fault/);
  });
  it('explains changing scores and keeps practice disclosure without technical evidence counts', () => {
    const result = presentActivity('DEMO ONLY low-medium. Reason: Check amounts. Measured before=89/green, after=63/yellow. Synthetic journey=34→64. Bank evidence={"matched":2157}. No live files or official clearance changed.', 'Updated');
    expect(result.title).toBe('Low-to-medium practice scenario selected');
    expect(result.facts).toContainEqual({ label: 'Record check score', value: '89 → 63 out of 100' });
    expect(result.summary).not.toContain('matched');
    expect(result.summary).toContain('not changed');
  });
  it('keeps simple descriptions and reports malformed historic snapshots explicitly', () => {
    expect(presentActivity('Registration approved for Tigist.', 'Approved')).toMatchObject({ summary: 'Registration approved for Tigist.', practice: false });
    const result = presentActivity('Amount discrepancy escalation requested: underpayment. Snapshot: {"broken":', 'Updated');
    expect(result.warning).toContain('incomplete');
    expect(result.summary).not.toContain('broken');
  });
  it('does not calculate a difference across currencies', () => {
    const result = presentActivity(`Amount discrepancy escalation requested: underpayment. Snapshot: ${JSON.stringify({ ...snapshot, line: { amount: 7200, currency: 'USD' } })}`, 'Updated');
    expect(result.facts.some(fact => fact.label === 'Amount short')).toBe(false);
  });
  it('does not describe contract or stage-fee estimates as a bank shortfall', () => {
    expect(presentActivity('Amount discrepancy escalation requested: underpayment, contract.', 'Updated').summary).toContain('not a confirmed bank shortfall');
    expect(presentActivity('Amount discrepancy escalation requested: underpayment, stage-fee.', 'Updated').title).toBe('Candidate stage fee needs review');
  });
  it('explains pause and reinstatement requests without claiming a final decision', () => {
    const result = presentActivity('Practice evidence only. Verified underpayment portal pause requested: Samuel Jemal. Reply by 2026-11-11. Snapshot: ' + JSON.stringify({ payment: snapshot.payment, matchingLines: [snapshot.line] }), 'Updated');
    expect(result.title).toBe('Agency pause requested after a checked payment shortfall');
    expect(result.practice).toBe(true);
    expect(result.facts).toContainEqual({ label: 'Bank amount', value: '7,200 ETB' });
    const reinstatement = presentActivity('Agency resolution reinstate requested: local:demo-local-1. Reason: Review finished. Case example.', 'Updated');
    expect(reinstatement.title).toBe('Request to let the agency resume work');
    expect(reinstatement.summary).not.toContain('demo-local-1');
  });
});
