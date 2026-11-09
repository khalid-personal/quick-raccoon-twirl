import type { Candidate, CandidateStage, StageStatus } from '../types';
import { MINISTRY_STAGE_MESSAGE } from '../ministry-candidates';

export const updateStageStatus = async (
  _candidateId: string, _stageId: number, _status: StageStatus,
  _notes?: string, _date?: string, _referenceId?: string,
): Promise<CandidateStage> => {
  throw new Error(MINISTRY_STAGE_MESSAGE);
};

export const confirmArrival = async (_candidateId: string): Promise<Candidate> => {
  throw new Error(MINISTRY_STAGE_MESSAGE);
};
