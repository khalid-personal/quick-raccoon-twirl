import type { JourneyLocation, MedicalResult, MedicalStatus } from '../types';
import { MINISTRY_STAGE_MESSAGE } from '../ministry-candidates';

export const updateMedicalResult = async (
  _candidateId: string, _examType: string, _status: MedicalStatus,
  _examDate?: string, _location?: JourneyLocation | null,
): Promise<MedicalResult> => {
  throw new Error(MINISTRY_STAGE_MESSAGE);
};
