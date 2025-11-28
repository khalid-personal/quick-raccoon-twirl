import { v4 as uuidv4 } from 'uuid';
import { MedicalResult, CandidateStage, StageStatus, ALL_STAGES } from '../types';
import { getMedicalResults, saveMedicalResults, getCandidateStages, saveCandidateStages } from '../data-store';

// Helper function to synchronize medical results with stage status
const syncMedicalStageStatus = (candidateId: string) => {
    const allResults = getMedicalResults().filter(r => r.candidate_id === candidateId);
    const allStages = getCandidateStages();
    
    const initialMedicalId = ALL_STAGES.find(s => s.slug === 'initial_medical')?.id;
    const finalMedicalId = ALL_STAGES.find(s => s.slug === 'final_medical')?.id;

    const updateStageStatus = (stageId: number, newStatus: StageStatus, allStages: CandidateStage[]) => {
        const stageIndex = allStages.findIndex(cs => cs.candidate_id === candidateId && cs.stage_id === stageId);
        if (stageIndex !== -1 && allStages[stageIndex].status !== newStatus) {
            allStages[stageIndex].status = newStatus;
            allStages[stageIndex].updated_at = new Date().toISOString();
            
            // Only set date if status is Passed/Issued/Completed
            if (newStatus === 'Passed' || newStatus === 'Issued' || newStatus === 'Completed') {
                allStages[stageIndex].date = new Date().toISOString();
            } else if (newStatus === 'Pending' || newStatus === 'Failed') {
                // Clear date if status reverts to Pending/Failed
                allStages[stageIndex].date = undefined;
            }
            return true;
        }
        return false;
    };

    let stagesChanged = false;

    // --- Logic for Initial Medical (Stage 1) ---
    if (initialMedicalId) {
        // Initial exams are all exams EXCEPT 'Final Agency Medical'
        const initialExams = allResults.filter(r => r.exam_type !== 'Final Agency Medical');
        let newStatus: StageStatus = 'Pending';

        if (initialExams.length > 0) {
            if (initialExams.some(r => r.status === 'Failed')) {
                newStatus = 'Failed';
            } else if (initialExams.every(r => r.status === 'Passed')) {
                newStatus = 'Passed';
            } else if (initialExams.some(r => r.status === 'Passed' || r.status === 'Pending')) {
                // If some are passed, but others are pending/in progress
                newStatus = 'In Progress'; 
            }
        }
        
        if (updateStageStatus(initialMedicalId, newStatus, allStages)) {
            stagesChanged = true;
        }
    }

    // --- Logic for Final Medical Clearance (Stage 9) ---
    if (finalMedicalId) {
        const finalExam = allResults.find(r => r.exam_type === 'Final Agency Medical');
        let newStatus: StageStatus = 'Pending';

        if (finalExam) {
            if (finalExam.status === 'Failed') {
                newStatus = 'Failed';
            } else if (finalExam.status === 'Passed') {
                newStatus = 'Passed';
            } else {
                newStatus = 'Pending';
            }
        }
        
        if (updateStageStatus(finalMedicalId, newStatus, allStages)) {
            stagesChanged = true;
        }
    }

    if (stagesChanged) {
        saveCandidateStages(allStages);
    }
};

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
    
    // SYNCHRONIZE STAGE STATUS AFTER MEDICAL RESULT UPDATE
    syncMedicalStageStatus(candidateId); 
    
    return result;
};