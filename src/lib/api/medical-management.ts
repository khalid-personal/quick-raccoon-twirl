import { v4 as uuidv4 } from 'uuid';
import { MedicalResult } from '../types';
import { getMedicalResults, saveMedicalResults } from '../data-store';

// Admin: Update Medical Result (needed for compliance testing)
export const updateMedicalResult = async (
    candidateId: string,
    examType: string,
    status: 'Passed' | 'Failed' | 'Pending',
    examDate?: string
): Promise<MedicalResult> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allResults = getMedicalResults();
    let result = allResults.find(r => r.candidate_id === candidateId && r.exam_type === examType);

    if (result) {
        result.status = status;
        result.exam_date = examDate || result.exam_date;
        result.notes = result.notes;
    } else {
        result = {
            id: uuidv4(),
            candidate_id: candidateId,
            exam_type: examType,
            status: status,
            exam_date: examDate,
            notes: undefined,
            document_id: undefined,
        };
        allResults.push(result);
    }

    saveMedicalResults(allResults);
    return result;
};