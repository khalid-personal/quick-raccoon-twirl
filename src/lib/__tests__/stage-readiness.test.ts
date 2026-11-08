// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getCandidateStages, getCandidates, getConfig, getMedicalResults, getPayments, getPaymentStatuses, initializeDataStore, saveCandidateStages, saveMedicalResults, savePaymentStatuses, savePayments } from '../data-store';
import { stageFeeCovered, stageProgressBlockers } from '../stage-readiness';
import { getActiveStageTasks } from '../staff-tasks';
import { updateStageStatus } from '../api/stage-management';
import { updateMedicalResult } from '../api/medical-management';
import { ALL_STAGES, type Payment } from '../types';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); initializeDataStore(); });
describe('ordered paid stage progression', () => {
  const setup = () => {
    const candidate = getCandidates()[0];
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === candidate.id ? { ...stage, status: stage.stage_id === 1 ? 'Completed' : 'Pending' } : stage));
    savePaymentStatuses(getPaymentStatuses().filter(payment => payment.candidateId !== candidate.id));
    savePayments([]);
    saveMedicalResults([]);
    return candidate;
  };
  it('blocks starting training when legacy completed registration is unpaid and assigns registration follow-up', async () => {
    const candidate = setup();
    await expect(updateStageStatus(candidate.id, 3, 'In Progress')).rejects.toThrow('Registration payment is required');
    const tasks = getActiveStageTasks([candidate], getCandidateStages(), Date.now(), { fees: getConfig().stageFees ?? {}, statuses: getPaymentStatuses(), payments: getPayments() });
    expect(tasks[0]).toMatchObject({ stage: { stage_id: 1 }, action: 'Await payment' });
    expect(stageProgressBlockers(candidate, 4, 'In Progress', getCandidateStages(), getConfig().stageFees ?? {}, getPaymentStatuses(), getPayments()).join(' ')).toContain('Training must be completed first');
  });
  it.each(['pending', 'failed', 'refunded', 'short', 'wrong-currency', 'wrong-agency', 'shared'] as const)('does not accept a paid checkbox when %s receipts contradict it', async kind => {
    const candidate = setup();
    savePaymentStatuses([{ candidateId: candidate.id, stageId: 1, isPaid: true }]);
    const fee = getConfig().stageFees![1];
    const payment: Payment = { id: 'registration-receipt', amount: kind === 'short' ? fee / 2 : fee, currency: kind === 'wrong-currency' ? 'USD' : 'ETB',
      status: kind === 'pending' || kind === 'failed' || kind === 'refunded' ? kind : 'succeeded',
      payer_type: 'candidate', payer_foreign_agency_id: '', payee_local_agency_id: kind === 'wrong-agency' ? 'other-local-agency' : candidate.local_agency_id!,
      candidate_ids: kind === 'shared' ? [candidate.id, 'second-candidate'] : [candidate.id], stage_id: 1, created_at: '2026-11-08', updated_at: '2026-11-08' };
    savePayments([payment]);
    expect(stageFeeCovered(candidate, 1, getConfig().stageFees ?? {}, getPaymentStatuses(), getPayments())).toBe(false);
    await expect(updateStageStatus(candidate.id, 3, 'In Progress')).rejects.toThrow('Await payment');
  });
  it('accepts successful candidate ETB split receipts covering registration without a checkbox', async () => {
    const candidate = setup(), fee = getConfig().stageFees![1];
    const receipt: Payment = { id: 'first', amount: fee / 2, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', payer_foreign_agency_id: '',
      payee_local_agency_id: candidate.local_agency_id!, candidate_ids: [candidate.id], stage_id: 1, created_at: '2026-11-08', updated_at: '2026-11-08' };
    savePayments([receipt, { ...receipt, id: 'second' }]);
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === candidate.id && stage.stage_id === 1 ? { ...stage, status: 'Completed' } : stage));
    await expect(updateStageStatus(candidate.id, 3, 'In Progress')).resolves.toMatchObject({ status: 'In Progress' });
    await expect(updateStageStatus(candidate.id, 2, 'In Progress')).rejects.toThrow('Training must be completed first');
  });
  it('medical saving cannot bypass unpaid registration even if training was manually completed', async () => {
    const candidate = setup();
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === candidate.id && stage.stage_id === 3 ? { ...stage, status: 'Completed' } : stage));
    const before = getMedicalResults();
    await expect(updateMedicalResult(candidate.id, 'HIV', 'Passed')).rejects.toThrow('Training must be completed');
    expect(getMedicalResults()).toEqual(before);
  });
  it('a single passing medical exam cannot complete the stage, and full results still require medical payment', async () => {
    const candidate = setup();
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === candidate.id && stage.stage_id !== 4 ? { ...stage, status: stage.stage_id === 2 ? 'Pending' : 'Completed' } : stage));
    savePaymentStatuses(ALL_STAGES.filter(stage => stage.id !== 2).map(stage => ({ candidateId: candidate.id, stageId: stage.id, isPaid: true })));
    await updateMedicalResult(candidate.id, 'HIV', 'Passed');
    expect(getCandidateStages().find(stage => stage.candidate_id === candidate.id && stage.stage_id === 2)?.status).toBe('In Progress');
    if (candidate.gender !== 'male') await updateMedicalResult(candidate.id, 'Pregnancy', 'Passed');
    await updateMedicalResult(candidate.id, 'Final Agency Medical', 'Passed');
    expect(getCandidateStages().find(stage => stage.candidate_id === candidate.id && stage.stage_id === 2)?.status).toBe('In Progress');
    await expect(updateStageStatus(candidate.id, 4, 'In Progress')).rejects.toThrow('Medical Check must be completed first');
  });
  it('cannot manually complete paid medical checks without every required exam', async () => {
    const candidate = setup();
    savePaymentStatuses(ALL_STAGES.map(stage => ({ candidateId: candidate.id, stageId: stage.id, isPaid: true })));
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === candidate.id && [1, 3].includes(stage.stage_id) ? { ...stage, status: 'Completed' } : stage));
    await expect(updateStageStatus(candidate.id, 2, 'Passed')).rejects.toThrow('Every required medical exam');
  });
});
