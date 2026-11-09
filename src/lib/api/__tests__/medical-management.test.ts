// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { getCandidateStages, getMedicalResults, saveCandidateStages, saveCandidates, saveMedicalResults } from '../../data-store';
import { updateMedicalResult } from '../medical-management';
import { updateStageStatus, confirmArrival } from '../stage-management';
import { MINISTRY_STAGE_MESSAGE } from '../../ministry-candidates';
import type { Candidate } from '../../types';

const candidate: Candidate = { id: 'person', first_name: 'Hana', last_name: 'Tadesse', dob: '1998-01-01', passport_number: 'SYN-1', tracking_code: 'TRK-1', country_of_origin: 'Ethiopia', marital_status: 'Single', email: 'hana@example.test', home_city: 'Adama', created_at: '2026-01-01', updated_at: '2026-01-01', payment_status: 'unpaid' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); saveCandidates([candidate]); });
it.each([1, 3, 2, 4])('rejects all manual status and date changes for stage %s without persisting anything', async stageId => {
  saveCandidateStages([{ id: `stage-${stageId}`, candidate_id: candidate.id, stage_id: stageId, status: 'Pending', updated_at: '2026-01-01' }]);
  const before = { ...localStorage };
  for (const status of ['Pending', 'In Progress', 'Passed', 'Failed', 'Issued', 'Completed'] as const) {
    await expect(updateStageStatus(candidate.id, stageId, status, 'edited', '2026-11-01', 'new-ref')).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  }
  expect({ ...localStorage }).toEqual(before);
});
it('rejects medical edits and candidate arrival even in practice mode', async () => {
  sessionStorage.setItem('dawm_demo_session', '1');
  const before = { ...localStorage };
  await expect(updateMedicalResult(candidate.id, 'HIV', 'Passed', '2026-11-01', { name: 'Clinic', city: 'Adama' })).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  await expect(confirmArrival(candidate.id)).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  expect({ ...localStorage }).toEqual(before);
});
it('does not backtrack ministry progression or write on reads when local payment evidence is missing', () => {
  saveCandidateStages([{ id: 'stage-4', candidate_id: candidate.id, stage_id: 4, status: 'Completed', date: '2026-11-01', updated_at: '2026-11-01', location: { name: 'Departure desk', city: 'Addis Ababa' } }]);
  saveMedicalResults([{ id: 'exam', candidate_id: candidate.id, exam_type: 'HIV', status: 'Passed', exam_date: '2026-11-01' }]);
  const before = { ...localStorage };
  expect(getCandidateStages()[0].status).toBe('Completed');
  expect(getMedicalResults()).toHaveLength(1);
  expect({ ...localStorage }).toEqual(before);
});
it('preserves previous ministry stage locations in history and keeps no-op saves idempotent', () => {
  const stage = { id: 'stage', candidate_id: candidate.id, stage_id: 3, status: 'In Progress' as const, updated_at: '2026-01-01', location: { name: 'First center', city: 'Adama' } };
  saveCandidateStages([stage]);
  saveCandidateStages([{ ...stage, status: 'Passed', location: { name: 'Second center', city: 'Hawassa' } }]);
  expect(getCandidateStages()[0].history?.map(item => item.location?.name)).toEqual(['First center', 'Second center']);
  saveCandidateStages(getCandidateStages());
  expect(getCandidateStages()[0].history).toHaveLength(2);
});
