import { ALL_STAGES, Stage } from '../types';
import { getCandidates, savePaymentStatuses, getPaymentStatuses } from '../data-store';

// Helper to find stage ID by slug
export const getStageId = (slug: string): Stage | undefined => ALL_STAGES.find(s => s.slug === slug);

// Initialize mock payment status for the seed candidate's active training stage.
if (getPaymentStatuses().length === 0) {
    const trainingStage = getStageId('training');
    const candidate1 = getCandidates().find(c => c.tracking_code === 'TRK-ET-0001');
    if (candidate1 && trainingStage) {
        savePaymentStatuses([{ candidateId: candidate1.id, stageId: trainingStage.id, isPaid: true }]);
    }
}