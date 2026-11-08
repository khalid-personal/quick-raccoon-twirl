import { describe, expect, it } from 'vitest';
import { contractWasSent, foreignContractPayment } from '../foreign-contract-payment';
import { generateDemoDataset } from '../demo-dataset';
import { contractCountryOf, minimumPerCandidate } from '../currency';
import type { Payment } from '../types';
import { foreignAgencyTasks } from '../foreign-staff-tasks';
import { analyzeAgencyPayments } from '../agency-payments';

const data = generateDemoDataset(Date.parse('2026-11-08'));
const candidate = { ...data.candidates.find(candidate => minimumPerCandidate(contractCountryOf(candidate)))!, work_contract_record: { status: 'sent' as const } };
const minimum = minimumPerCandidate(contractCountryOf(candidate))!;
const receipt: Payment = { id: 'contract', payer_type: 'foreign-agency', payer_foreign_agency_id: candidate.foreign_agency_id!,
  payee_local_agency_id: candidate.local_agency_id!, candidate_ids: [candidate.id], amount: minimum.amount, currency: minimum.currency,
  status: 'succeeded', created_at: '2026-11-08', updated_at: '2026-11-08' };

describe('foreign contract receipt requirements', () => {
  it('requires a receipt immediately after sending, independent of legacy paid flags', () => {
    expect(foreignContractPayment({ ...candidate, payment_status: 'paid' }, []).paid).toBe(false);
    const tasks = foreignAgencyTasks(candidate.foreign_agency_id!, [candidate], data.stages, {}, [], []);
    expect(tasks[0].action).toBe('Make contract payment');
    expect(tasks[0].candidate.id).toBe(candidate.id);
  });
  it.each(['pending', 'failed', 'refunded'] as const)('does not accept %s transfers', status => {
    expect(foreignContractPayment(candidate, [{ ...receipt, status }]).paid).toBe(false);
  });
  it('rejects wrong agency, currency, payer, duplicates and short allocations', () => {
    for (const changed of [
      { payer_foreign_agency_id: 'other' }, { payee_local_agency_id: 'other' }, { currency: 'ETB' },
      { payer_type: 'candidate' as const }, { candidate_ids: [candidate.id, candidate.id] }, { amount: minimum.amount / 2 },
      { candidate_ids: [candidate.id, 'second'] },
    ]) expect(foreignContractPayment(candidate, [{ ...receipt, ...changed }]).paid).toBe(false);
  });
  it('accepts cumulative split receipts and fully covered group allocations', () => {
    const split = [{ ...receipt, amount: minimum.amount / 2 }, { ...receipt, id: 'second', amount: minimum.amount / 2 }];
    expect(foreignContractPayment(candidate, split).paid).toBe(true);
    expect(analyzeAgencyPayments([candidate], split, []).rows[0].issue).toBe('paid');
    expect(analyzeAgencyPayments([candidate], [], [], Date.parse('2026-11-08')).rows[0].issue).toBe('missing');
    expect(foreignContractPayment(candidate, [{ ...receipt, candidate_ids: [candidate.id, 'second'], amount: minimum.amount * 2 }]).paid).toBe(true);
  });
  it('uses explicit handoff status over old work-contract flags', () => {
    expect(contractWasSent({ ...candidate, external_status: { work_contract: true }, work_contract_record: { status: 'not-sent' } })).toBe(false);
    expect(contractWasSent({ ...candidate, work_contract_record: { status: 'received' } })).toBe(true);
    expect(contractWasSent({ ...candidate, work_contract_record: undefined, external_status: { work_contract: true } })).toBe(true);
  });
});
