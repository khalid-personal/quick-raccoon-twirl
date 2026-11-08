import { describe, expect, it } from 'vitest';
import { enforceStageContinuity, normalizeCandidateStages, revertUnpaidCompletedStages } from '../candidate-stage-normalization';
import { ALL_STAGES, type Candidate, type CandidateStage, type PaymentStatus } from '../types';

const candidate: Candidate = {
  id: 'candidate-1',
  first_name: 'Test',
  last_name: 'Candidate',
  dob: '1995-01-01',
  passport_number: 'P1',
  tracking_code: 'TRK-ET-0001',
  country_of_origin: 'Ethiopia',
  marital_status: 'Single',
  email: 'candidate@example.test',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  payment_status: 'unpaid',
};

const stage = (stageId: number, status: CandidateStage['status']): CandidateStage => ({
  id: `stage-${stageId}`,
  candidate_id: candidate.id,
  stage_id: stageId,
  status,
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('candidate stage normalization', () => {
  it('selects the latest duplicate without crossing candidates and preserves first record on a timestamp tie', () => {
    const old = { ...stage(1, 'Pending'), id: 'old' };
    const newest = { ...stage(1, 'Passed'), id: 'new', updated_at: '2026-01-03' };
    const sameTime = { ...newest, id: 'tie', status: 'Pending' as const };
    const other = { ...newest, id: 'other', candidate_id: 'other' };
    const normalized = normalizeCandidateStages([old, newest, sameTime, other], [candidate]);
    expect(normalized.find(stage => stage.candidate_id === candidate.id && stage.stage_id === 1)?.id).toBe('new');
    expect(normalized.find(stage => stage.candidate_id === 'other' && stage.stage_id === 1)?.id).toBe('other');
  });
  it('rolls back skipped stages without completing prerequisites or discarding evidence', () => {
    const input = [stage(1, 'Passed'), stage(3, 'In Progress'), { ...stage(2, 'Completed'), date: '2026-01-02', notes: 'Keep evidence', reference_id: 'REF', assigned_staff_id: 'staff' }, stage(4, 'In Progress')];
    const normalized = enforceStageContinuity(input);
    expect(normalized.map(stage => stage.status)).toEqual(['Passed', 'In Progress', 'Pending', 'Pending']);
    expect(normalized[2]).toMatchObject({ notes: 'Keep evidence', reference_id: 'REF', assigned_staff_id: 'staff', date: undefined });
    expect(enforceStageContinuity(normalized)).toEqual(normalized);
    expect(input[2].status).toBe('Completed');
  });
  it('closes all subsequent stages after an earlier paid completion is reverted', () => {
    const input = ALL_STAGES.map(meta => stage(meta.id, 'Completed'));
    const paid = ALL_STAGES.filter(meta => meta.id !== 3).map(meta => ({ candidateId: candidate.id, stageId: meta.id, isPaid: true }));
    const normalized = enforceStageContinuity(revertUnpaidCompletedStages(input, paid, { 1: 100, 3: 100, 2: 100, 4: 100 }));
    expect(normalized.map(stage => stage.status)).toEqual(['Completed', 'In Progress', 'Pending', 'Pending']);
    expect(enforceStageContinuity(input)).toEqual(input);
  });
  it('removes legacy stages, restores missing canonical stages, and orders them consistently', () => {
    const normalized = normalizeCandidateStages([
      stage(1, 'In Progress'),
      stage(99, 'Passed'),
    ], [candidate]);

    expect(normalized.map(record => record.stage_id)).toEqual(ALL_STAGES.map(item => item.id));
    expect(normalized.some(record => record.stage_id === 99)).toBe(false);
    expect(normalized.find(record => record.stage_id === 1)?.status).toBe('In Progress');
    expect(normalized.filter(record => record.status === 'Pending')).toHaveLength(3);
  });

  it('reverts completed stages with an unpaid configured fee to in progress', () => {
    const completed = { ...stage(1, 'Completed'), date: '2026-01-02' };
    const [reconciled] = revertUnpaidCompletedStages([completed], [], { 1: 500 }, '2026-01-03T00:00:00.000Z');

    expect(reconciled.status).toBe('In Progress');
    expect(reconciled.date).toBeUndefined();
    expect(reconciled.updated_at).toBe('2026-01-03T00:00:00.000Z');
  });

  it('preserves paid completion and stages without a configured fee', () => {
    const paidStatus: PaymentStatus = { candidateId: candidate.id, stageId: 1, isPaid: true };
    const paid = stage(1, 'Passed');
    const noFee = stage(3, 'Completed');
    const reconciled = revertUnpaidCompletedStages([paid, noFee], [paidStatus], { 1: 500, 3: 0 });

    expect(reconciled).toEqual([paid, noFee]);
  });
});
