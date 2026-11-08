// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { generateDemoDataset } from '../../demo-dataset';
import { contractCountryOf, minimumPerCandidate } from '../../currency';
import { getPayments, getPaymentStatuses, saveCandidates, saveForeignAgencies, saveLocalAgencies, savePayments, savePaymentStatuses } from '../../data-store';
import { initiatePayment } from '../payment-processing';

const demo = generateDemoDataset(new Date('2026-11-07').getTime());
const candidate = demo.candidates.find(item => minimumPerCandidate(contractCountryOf(item)))!;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveCandidates(demo.candidates); saveForeignAgencies(demo.foreignAgencies); saveLocalAgencies(demo.localAgencies);
  savePayments([]); savePaymentStatuses(demo.paymentStatuses);
});

describe('foreign demo settlement matches displayed contract prices', () => {
  it('records the native contract currency and price, not a placeholder ETB fee', async () => {
    const minimum = minimumPerCandidate(contractCountryOf(candidate))!;
    const stagePayments = getPaymentStatuses();
    const result = await initiatePayment(candidate.foreign_agency_id!, [candidate.id], 'operator', 'operator@example.test', minimum.currency);
    expect(getPayments().find(payment => payment.id === result.paymentId)).toMatchObject({
      amount: minimum.amount, currency: minimum.currency, payer_type: 'foreign-agency', status: 'pending',
      initiated_by: { id: 'operator', email: 'operator@example.test' }, payment_method: 'DEMO / synthetic foreign settlement',
    });
    expect(getPaymentStatuses()).toEqual(stagePayments);
  });
  it('rejects live use before creating a mock payment', async () => {
    sessionStorage.removeItem('dawm_demo_session');
    await expect(initiatePayment(candidate.foreign_agency_id!, [candidate.id], 'operator', 'operator@example.test')).rejects.toThrow('demo-only');
    expect(getPayments()).toEqual([]);
  });
  it('rejects a currency that does not match the contract without recording money', async () => {
    await expect(initiatePayment(candidate.foreign_agency_id!, [candidate.id], 'operator', 'operator@example.test', 'ETB')).rejects.toThrow('currency must match');
    expect(getPayments()).toEqual([]);
  });
});
