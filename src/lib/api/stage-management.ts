import { CandidateStage, StageStatus, ALL_STAGES } from '../types';
import { getCandidateStages, saveCandidateStages, getMedicalResults } from '../data-store';
import { getStageId } from './utils';

// PATCH /api/admin/candidate/:id/status
export const updateStageStatus = async (
    candidateId: string,
    stageId: number,
    status: StageStatus,
    notes?: string,
    date?: string,
    referenceId?: string // Added new parameter
): Promise<CandidateStage> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allStages = getCandidateStages();
    const candidateStageIndex = allStages.findIndex(
        cs => cs.candidate_id === candidateId && cs.stage_id === stageId
    );

    if (candidateStageIndex === -1) {
        throw new Error('Stage not found for candidate.');
    }

    const stageSlug = ALL_STAGES.find(s => s.id === stageId)?.slug;

    // --- Compliance Rule 1 & 2: Final Medical Clearance Check for Flight Booking ---
    if (stageSlug === 'flight_departure' && (status === 'In Progress' || status === 'Completed')) {
        const finalMedicalStage = allStages.find(
            cs => cs.candidate_id === candidateId && ALL_STAGES.find(s => s.id === cs.stage_id)?.slug === 'final_medical'
        );

        if (finalMedicalStage?.status !== 'Passed') {
            throw new Error('Departure Blocked: Final Medical Clearance must be Passed (Fit).');
        }

        const medicalResults = getMedicalResults().filter(mr => mr.candidate_id === candidateId);

        // Check for pregnancy test failure (Unfit status)
        const pregnancyTestFailed = medicalResults.some(mr => mr.exam_type === 'Pregnancy' && mr.status === 'Failed');

        if (pregnancyTestFailed) {
            throw new Error('Departure Blocked: Pregnancy test result prevents flight booking (Unfit).');
        }
    }

    const updatedStage = {
        ...allStages[candidateStageIndex],
        status,
        notes: notes ?? allStages[candidateStageIndex].notes,
        date: date ?? (status !== 'Pending' ? new Date().toISOString() : undefined),
        reference_id: referenceId ?? allStages[candidateStageIndex].reference_id, // Save new field
        updated_at: new Date().toISOString(),
    };

    allStages[candidateStageIndex] = updatedStage;
    saveCandidateStages(allStages);
    return updatedStage;
};