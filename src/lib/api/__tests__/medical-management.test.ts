// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getCandidates, getCandidateStages, getMedicalResults, getPaymentStatuses, initializeDataStore, saveCandidateStages, saveMedicalResults, savePaymentStatuses } from '../../data-store';
import { updateMedicalResult } from '../medical-management';
import { updateStageStatus } from '../stage-management';
import { ALL_STAGES } from '../../types';

describe('medical stage and gender rules', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initializeDataStore();
  });

  it('does not expose or retain pregnancy results for male candidates', async () => {
    const male = getCandidates().find(candidate => candidate.gender === 'male')!;
    const existing = getMedicalResults();
    saveMedicalResults([...existing, {
      id: 'legacy-male-pregnancy',
      candidate_id: male.id,
      exam_type: 'Pregnancy',
      status: 'Failed',
    }]);

    expect(getMedicalResults().some(result => result.id === 'legacy-male-pregnancy')).toBe(false);
    await expect(updateMedicalResult(male.id, 'Pregnancy', 'Pending')).rejects.toThrow('Pregnancy results cannot be recorded for a male candidate.');
  });

  it('requires training completion before starting the medical stage', async () => {
    const candidate = getCandidates().find(record => record.tracking_code === 'TRK-ET-0001')!;
    const medicalStage = ALL_STAGES.find(stage => stage.slug === 'medical')!;
    savePaymentStatuses([...getPaymentStatuses(), { candidateId: candidate.id, stageId: 1, isPaid: true }]);
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === candidate.id && stage.stage_id === 1 ? { ...stage, status: 'Completed' } : stage));

    await expect(updateStageStatus(candidate.id, medicalStage.id, 'In Progress')).rejects.toThrow('Training must be completed first.');
    await expect(updateMedicalResult(candidate.id, 'HIV', 'Pending')).rejects.toThrow('Training must be completed before recording medical results.');
    await expect(updateStageStatus(candidate.id, medicalStage.id, 'Failed')).rejects.toThrow('Training must be completed first.');
  });

  it('blocks stage completion until its fee is paid, but permits work to start', async () => {
    const candidate = getCandidates().find(record => record.tracking_code === 'TRK-ET-0001')!;
    const registrationStage = ALL_STAGES.find(stage => stage.slug === 'registration')!;
    savePaymentStatuses(getPaymentStatuses().filter(payment =>
      payment.candidateId !== candidate.id || payment.stageId !== registrationStage.id,
    ));

    await expect(updateStageStatus(candidate.id, registrationStage.id, 'In Progress')).resolves.toMatchObject({ status: 'In Progress' });
    await expect(updateStageStatus(candidate.id, registrationStage.id, 'Completed'))
      .rejects.toThrow('Registration cannot be completed until its 500 ETB stage fee is paid.');

    savePaymentStatuses([...getPaymentStatuses(), { candidateId: candidate.id, stageId: registrationStage.id, isPaid: true }]);
    await expect(updateStageStatus(candidate.id, registrationStage.id, 'Completed')).resolves.toMatchObject({ status: 'Completed' });
  });
  it('can start male deployment without a pregnancy check or an undefined candidate error', async () => {
    const male = getCandidates().find(candidate => candidate.gender === 'male')!;
    const deployment = ALL_STAGES.find(stage => stage.slug === 'deployment')!;
    savePaymentStatuses([
      ...getPaymentStatuses().filter(payment => payment.candidateId !== male.id),
      ...ALL_STAGES.map(stage => ({ candidateId: male.id, stageId: stage.id, isPaid: true })),
    ]);
    saveCandidateStages(getCandidateStages().map(stage => stage.candidate_id === male.id && stage.stage_id !== deployment.id
      ? { ...stage, status: 'Completed' } : stage));
    await expect(updateStageStatus(male.id, deployment.id, 'In Progress')).resolves.toMatchObject({ status: 'In Progress' });
  });
});
