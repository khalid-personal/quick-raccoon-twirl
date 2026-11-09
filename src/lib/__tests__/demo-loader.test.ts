// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { bootDemo, loadDemoData, removeDemoData, repairDemoStagePlaceholders, ensureDemoMedicalLocations } from '../demo-loader';
import { demoConfigPatch, generateDemoDataset } from '../demo-dataset';
import { getCandidateStages, getCandidates, getConfig, getPayments, getPaymentStatuses, saveCandidateStages, saveCandidates, saveConfig, savePaymentStatuses, getMedicalResults, saveMedicalResults } from '../data-store';
import { calculateOverallStatus } from '../utils-data';
import { candidateListStatus, summarizeCandidateListStatuses } from '../candidate-list-status';
import type { CandidateSummary } from '../types';

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
});
const summaries = (): CandidateSummary[] => {
  const stages = getCandidateStages();
  return getCandidates().map(candidate => ({
    ...candidate, overall_status: calculateOverallStatus(stages.filter(stage => stage.candidate_id === candidate.id)),
    progress_percent: 0, is_medical_paid: false, paid_stage_ids: [],
  }));
};
describe('stored demo workflow integration', () => {
  it('backfills only untouched fictional medical locations, preserving operator edits, result dates and live storage', () => {
    loadDemoData();
    const examples = getMedicalResults().filter(result => result.location && result.exam_date).slice(0, 3);
    expect(examples).toHaveLength(3);
    saveMedicalResults(examples.map((result, index) => ({ ...result, location: index === 1 ? { name: 'Operator clinic', city: 'Adama' } : undefined, recorded_at: index === 2 ? '2026-01-01' : undefined })));
    expect(ensureDemoMedicalLocations()).toBe(1);
    const after = getMedicalResults();
    expect(after[0].location).toEqual(examples[0].location);
    expect(after[0].exam_date).toBe(examples[0].exam_date);
    expect(after[1].location?.name).toBe('Operator clinic');
    expect(after[2].location).toBeUndefined();
    expect(ensureDemoMedicalLocations()).toBe(0);
    sessionStorage.removeItem('dawm_demo_session');
    expect(ensureDemoMedicalLocations()).toBe(0);
  });
  it('removes synthetic candidates without regenerating orphan stages', () => {
    loadDemoData();
    removeDemoData();
    expect(getCandidates()).toEqual([]);
    expect(getCandidateStages()).toEqual([]);
    expect(getPaymentStatuses()).toEqual([]);
  });
  it('loads paid completed deployments and all four list states without placeholder duplication', () => {
    bootDemo();
    const counts = summarizeCandidateListStatuses(summaries());
    expect(counts.total).toBe(435);
    expect(counts.inProgress).toBeGreaterThan(0);
    expect(counts.pendingQr).toBeGreaterThan(0);
    expect(counts.completed).toBeGreaterThan(100);
    expect(counts.failed).toBeGreaterThan(0);
    expect(getCandidateStages()).toHaveLength(435 * 4);
    expect(getCandidateStages().every(stage => stage.id.startsWith('demo-stg-'))).toBe(true);
    expect(new Set(getPayments().map(payment => payment.status))).toEqual(new Set(['succeeded', 'pending', 'failed', 'refunded']));
    const completed = new Set(summaries().filter(candidate => candidateListStatus(candidate) === 'completed').map(candidate => candidate.id));
    const beforeRead = { ...localStorage };
    getCandidateStages().filter(stage => completed.has(stage.candidate_id)).forEach(stage => {
      expect(['Completed', 'Passed', 'Issued']).toContain(stage.status);
    });
    expect({ ...localStorage }).toEqual(beforeRead);
    const before = getCandidateStages();
    bootDemo();
    expect(getCandidateStages()).toEqual(before);
  });
  it('repairs only untouched blank demo placeholders and never replaces staff edits or live storage', () => {
    const demo = generateDemoDataset(Date.now());
    saveConfig(demoConfigPatch(getConfig(), demo));
    saveCandidates(demo.candidates.slice(0, 2));
    savePaymentStatuses(demo.paymentStatuses);
    saveCandidateStages([]);
    const blank = getCandidateStages();
    blank.find(stage => stage.candidate_id === demo.candidates[1].id)!.notes = 'Staff manually reviewed this file';
    saveCandidateStages(blank);
    expect(repairDemoStagePlaceholders()).toBe(1);
    expect(getCandidateStages().filter(stage => stage.candidate_id === demo.candidates[0].id).every(stage => stage.id.startsWith('demo-stg-'))).toBe(true);
    expect(getCandidateStages().find(stage => stage.notes === 'Staff manually reviewed this file')).toBeDefined();
    sessionStorage.removeItem('dawm_demo_session');
    expect(repairDemoStagePlaceholders()).toBe(0);
    expect(() => loadDemoData()).toThrow('demo sandbox');
  });
});
