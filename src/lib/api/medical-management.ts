import { v4 as uuidv4 } from 'uuid';
import { MedicalResult, CandidateStage, StageStatus, ALL_STAGES } from '../types';
import { getMedicalResults, saveMedicalResults, getCandidateStages, saveCandidateStages, getCandidates, getConfig, getPaymentStatuses, getPayments } from '../data-store';
import { requiredMedicalExams, stageFeeCovered, stageProgressBlockers } from '../stage-readiness';

// Helper function to synchronize medical results with stage status
const syncMedicalStageStatus = (candidateId: string) => {
    const allResults = getMedicalResults().filter(r => r.candidate_id === candidateId);
    const allStages = getCandidateStages();
    const medicalStageId = ALL_STAGES.find(s => s.slug === 'medical')?.id;

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

    if (medicalStageId) {
        const candidate = getCandidates().find(candidate => candidate.id === candidateId);
        if (!candidate) throw new Error('Candidate not found.');
        const examTypes = requiredMedicalExams(candidate.gender);
        const medicalExams = allResults.filter(result => examTypes.includes(result.exam_type));
        let newStatus: StageStatus = 'Pending';

        if (medicalExams.some(result => result.status === 'Failed')) {
            newStatus = 'Failed';
        } else if (examTypes.every(exam => medicalExams.some(result => result.exam_type === exam && result.status === 'Passed'))
            && stageFeeCovered(candidate, medicalStageId, getConfig().stageFees ?? {}, getPaymentStatuses(), getPayments())) {
            newStatus = 'Passed';
        } else if (medicalExams.some(result => result.status === 'Passed' || result.status === 'Pending')) {
            newStatus = 'In Progress';
        }

        if (updateStageStatus(medicalStageId, newStatus, allStages)) {
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
    if (examType === 'Pregnancy' && getCandidates().find(candidate => candidate.id === candidateId)?.gender === 'male') {
        throw new Error('Pregnancy results cannot be recorded for a male candidate.');
    }
    const stages = getCandidateStages();
    const trainingStageId = ALL_STAGES.find(stage => stage.slug === 'training')?.id;
    const trainingStage = stages.find(stage => stage.candidate_id === candidateId && stage.stage_id === trainingStageId);
    if (!trainingStage || !['Passed', 'Issued', 'Completed'].includes(trainingStage.status)) {
        throw new Error('Training must be completed before recording medical results.');
    }
    const candidate = getCandidates().find(candidate => candidate.id === candidateId);
    if (!candidate) throw new Error('Candidate not found.');
    const medicalStageId = ALL_STAGES.find(stage => stage.slug === 'medical')!.id;
    const blockers = stageProgressBlockers(candidate, medicalStageId, 'In Progress', stages, getConfig().stageFees ?? {}, getPaymentStatuses(), getPayments());
    if (blockers.length) throw new Error(blockers.join(' '));
    const allResults = getMedicalResults();
    let result = allResults.find(r => r.candidate_id === candidateId && r.exam_type === examType);

    if (result) {
        result.status = status;
        result.exam_date = examDate || result.exam_date;
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
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    
    return result;
};