import { ALL_STAGES, Stage } from '../types';
import { getCandidates, savePaymentStatuses, getPaymentStatuses } from '../data-store';

// Helper to find stage ID by slug
export const getStageId = (slug: string): Stage | undefined => ALL_STAGES.find(s => s.slug === slug);

// Initialize mock payment status for existing seed data (e.g., Candidate 1 paid for Initial Medical)
if (getPaymentStatuses().length === 0) {
    const initialMedicalStage = getStageId('initial_medical');
    const candidate1 = getCandidates().find(c => c.tracking_code === 'TRK-ET-0001');
    if (candidate1 && initialMedicalStage) {
        savePaymentStatuses([{ candidateId: candidate1.id, stageId: initialMedicalStage.id, isPaid: true }]);
    }
}