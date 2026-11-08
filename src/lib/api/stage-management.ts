import { CandidateStage, StageStatus, ALL_STAGES } from '../types';
import { getCandidateStages, saveCandidateStages, getMedicalResults, getCandidates, saveCandidates, getPaymentStatuses, getConfig } from '../data-store';
import { departureBlockers } from '../departure-readiness';
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
    const candidate = getCandidates().find(record => record.id === candidateId);
    if (!candidate) throw new Error('Candidate not found.');

    const stageSlug = ALL_STAGES.find(s => s.id === stageId)?.slug;
    const targetStage = ALL_STAGES.find(stage => stage.id === stageId);
    if (['Passed', 'Issued', 'Completed'].includes(status) && targetStage) {
        const stageFee = getConfig().stageFees?.[stageId] ?? targetStage.fee_amount ?? 0;
        const isStagePaid = getPaymentStatuses().some(payment =>
            payment.candidateId === candidateId && payment.stageId === stageId && payment.isPaid,
        );
        if (stageFee > 0 && !isStagePaid) {
            throw new Error(`${targetStage.title} cannot be completed until its ${stageFee.toLocaleString()} ETB stage fee is paid.`);
        }
    }
    const activating = status !== 'Pending';
    if (activating && targetStage && targetStage.ordinal > 1) {
        const unfinished = ALL_STAGES.filter(stage => stage.ordinal < targetStage.ordinal).find(stage =>
            !allStages.some(record => record.candidate_id === candidateId && record.stage_id === stage.id && ['Passed', 'Issued', 'Completed'].includes(record.status)));
        if (unfinished) throw new Error(`${unfinished.title} must be completed first.`);
    }

    if (stageSlug === 'deployment' && ['Passed', 'Issued', 'Completed'].includes(status)) {
        const blockers = departureBlockers(candidate);
        if (blockers.length) throw new Error(`Departure blocked: ${blockers.join(', ')}.`);
    }

    if (stageSlug === 'deployment' && (status === 'In Progress' || status === 'Completed')) {
        const medicalResults = getMedicalResults().filter(mr => mr.candidate_id === candidateId);

        // Check for pregnancy test failure (Unfit status)
        const pregnancyTestFailed = candidate.gender !== 'male' && medicalResults.some(mr => mr.exam_type === 'Pregnancy' && mr.status === 'Failed');

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

export const confirmArrival = async (candidateId: string) => {
    const candidate = getCandidates().find(record => record.id === candidateId);
    if (!candidate) throw new Error('Candidate not found.');
    if (candidate.arrival?.arrived_at) return candidate;
    const blockers = departureBlockers(candidate);
    if (blockers.length) throw new Error(`Arrival confirmation blocked: ${blockers.join(', ')}.`);
    const stage = ALL_STAGES.find(record => record.slug === 'deployment');
    if (!stage) throw new Error('Deployment stage is not configured.');
    await updateStageStatus(candidateId, stage.id, 'Completed');
    const updated = { ...candidate, arrival: { arrived_at: new Date().toISOString(), confirmed_by: 'candidate' as const }, updated_at: new Date().toISOString() };
    saveCandidates(getCandidates().map(record => record.id === candidateId ? updated : record));
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    return updated;
};