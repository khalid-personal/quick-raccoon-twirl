// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { generateDemoDataset } from '../../demo-dataset';
import { analyzeIntegrity, riskScore, scopeIntegrityFindings } from '../../integrity';
import { getExecutiveMetrics } from '../executive-metrics';
import { saveCandidates, saveCandidateStages, savePayments, saveLocalAgencies, saveApprovalLogs, saveMedicalResults, saveDocuments } from '../../data-store';
import type { Payment } from '../../types';

const candidates = generateDemoDataset(Date.parse('2026-11-07')).candidates.slice(0, 3).map((candidate, index) => ({
  ...candidate, local_agency_id: index === 2 ? 'b' : 'a', passport_number: index < 2 ? 'SHARED' : 'UNIQUE',
  email: `candidate${index}@example.test`, clearance: undefined, arrival: undefined,
}));
const receipt: Payment = { id: 'a-receipt', amount: 500, currency: 'ETB', payer_type: 'candidate', payer_foreign_agency_id: '',
  candidate_ids: [candidates[0].id], payee_local_agency_id: 'a', created_at: '2026-11-07', updated_at: '2026-11-07', status: 'succeeded' };
const payments = [receipt, { ...receipt, id: 'b-receipt', candidate_ids: [candidates[2].id], payee_local_agency_id: 'b', amount: 900 }];
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  saveLocalAgencies([{ id: 'a', name: 'Same agency name', created_at: '2026-11-07' }, { id: 'b', name: 'Same agency name', created_at: '2026-11-07' }]);
  saveCandidates(candidates); saveCandidateStages([]); savePayments(payments); saveMedicalResults([]); saveDocuments([]);
  saveApprovalLogs([
    { id: 'a-log', target_type: 'Payment', target_id: 'a-receipt', timestamp: '2026-11-07', actor_id: 'staff', actor_email: 'staff@example.test', action: 'Updated', description: 'Agency A receipt checked' },
    { id: 'b-log', target_type: 'Payment', target_id: 'b-receipt', timestamp: '2026-11-07', actor_id: 'other', actor_email: 'other@example.test', action: 'Updated', description: 'Agency B receipt checked' },
  ]);
});
it('filters executive totals, money and activity by agency ID even when agency names are identical', async () => {
  const a = await getExecutiveMetrics(undefined, undefined, 'a');
  const b = await getExecutiveMetrics(undefined, undefined, 'b');
  expect(a.totals.candidates).toBe(2);
  expect(b.totals.candidates).toBe(1);
  expect(a.activity.map(event => event.id)).toEqual(['a-log']);
  expect(b.activity.map(event => event.id)).toEqual(['b-log']);
  expect(a.trend.reduce((sum, month) => sum + month.revenue, 0)).toBe(500);
  expect(b.trend.reduce((sum, month) => sum + month.revenue, 0)).toBe(900);
  const missing = await getExecutiveMetrics(undefined, undefined, 'unknown');
  expect(missing.totals.candidates).toBe(0);
  expect(missing.trend.reduce((sum, month) => sum + month.revenue, 0)).toBe(0);
  expect(missing.activity).toEqual([]);
});
it('calculates agency scores from attributed warnings while retaining cross-agency duplicate detection', () => {
  const findings = analyzeIntegrity({ candidates, payments: [], stages: [], medicals: [], logs: [], paymentStatuses: [] });
  const a = scopeIntegrityFindings(findings, candidates, payments, 'a');
  const b = scopeIntegrityFindings(findings, candidates, payments, 'b');
  expect(a.filter(finding => finding.rule === 'duplicate-passport')).toHaveLength(2);
  expect(b.some(finding => finding.rule === 'duplicate-passport')).toBe(false);
  expect(riskScore(a, 2)).toBeLessThan(riskScore(b, 1));
  const crossAgency = [{ id: 'cross', rule: 'duplicate-passport', candidateId: candidates[2].id, title: '', detail: '', severity: 'critical' as const }];
  expect(scopeIntegrityFindings(crossAgency, candidates, payments, 'b')).toEqual(crossAgency);
});
