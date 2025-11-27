import { ALL_STAGES } from '../types';
import { getCandidates, savePaymentStatuses } from '../data-store';

// Helper to find stage ID by slug
export const getStageId = (slug: string) => ALL_STAGES.find(s => s.slug === slug)?.id;

// --- Mock Payment Status Store ---
export const LS_PAYMENT_STATUS = 'mock_payment_status';

interface PaymentStatus {
    candidateId: string;
    stageId: number;
    isPaid: boolean;
}

export const getPaymentStatuses = (): PaymentStatus[] => JSON.parse(localStorage.getItem(LS_PAYMENT_STATUS) || '[]');

// Initialize mock payment status for existing seed data (e.g., Candidate 1 paid for Initial Medical)
if (getPaymentStatuses().length === 0) {
    const initialMedicalStageId = getStageId('initial_medical');
    const candidate1 = getCandidates().find(c => c.tracking_code === 'TRK-ET-0001');
    if (candidate1 && initialMedicalStageId) {
        savePaymentStatuses([{ candidateId: candidate1.id, stageId: initialMedicalStageId, isPaid: true }]);
    }
}