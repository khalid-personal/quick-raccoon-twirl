import {
    PublicTrackingData,
    ALL_STAGES,
    StageStatus,
} from '../types';
import { getCandidates, getCandidateStages, getMedicalResults, getDocuments, getPaymentStatuses } from '../data-store';
import { calculateProgress } from '../utils-data';
import { getStageId } from './utils';
import { getCandidateDetail } from './candidate-crud';

// GET /api/track/:tracking_code
export const getPublicTrackingData = async (trackingCode: string): Promise<PublicTrackingData | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.tracking_code === trackingCode);
    if (!candidate) return null;

    const stages = getCandidateStages().filter(cs => cs.candidate_id === candidate.id);
    const medicalResults = getMedicalResults().filter(mr => mr.candidate_id === candidate.id);
    const documents = getDocuments().filter(d => d.candidate_id === candidate.id);
    const paymentStatuses = getPaymentStatuses(); // Get mock payment statuses

    const progress_percent = calculateProgress(stages);

    const timeline = stages
        .map(cs => {
            const stage = ALL_STAGES.find(s => s.id === cs.stage_id)!;
            const stageDocs = documents.filter(d => d.stage_id === stage.id);

            let medical_status_summary: StageStatus | undefined = undefined;
            const is_medical_stage = stage.slug === 'initial_medical' || stage.slug === 'final_medical';

            // Determine payment status
            const is_fee_paid = paymentStatuses.some(ps => ps.candidateId === candidate.id && ps.stageId === stage.id && ps.isPaid);

            if (is_medical_stage) {
                // Summarize medical results for public view (Rule: only show Pass/Fail/Pending)
                const relevantResults = medicalResults.filter(mr =>
                    (stage.slug === 'initial_medical' && mr.exam_type !== 'Final Agency Medical') ||
                    (stage.slug === 'final_medical' && mr.exam_type === 'Final Agency Medical')
                );

                if (relevantResults.length > 0) {
                    const failed = relevantResults.some(r => r.status === 'Failed');
                    const pending = relevantResults.some(r => r.status === 'Pending');

                    if (failed) {
                        medical_status_summary = 'Failed';
                    } else if (pending) {
                        medical_status_summary = 'Pending';
                    } else {
                        medical_status_summary = 'Passed';
                    }
                } else {
                    medical_status_summary = 'Pending';
                }
            }

            return {
                stage_id: stage.id, // ADDED stage_id
                title: stage.title,
                status: cs.status,
                date: cs.date,
                notes: cs.notes,
                is_medical_stage,
                // Use the calculated summary if it's a medical stage, otherwise use the stage status
                medical_status_summary: medical_status_summary || cs.status,
                documents: stageDocs.map(d => ({
                    ...d,
                    // Only expose necessary fields for public view
                    file_name: d.file_name,
                    public_url: d.public_url,
                })),
                fee_amount: stage.fee_amount, // Include fee amount
                is_fee_paid: is_fee_paid, // Include payment status
            };
        })
        .sort((a, b) => {
            const stageA = ALL_STAGES.find(s => s.title === a.title)?.ordinal || 0;
            const stageB = ALL_STAGES.find(s => s.title === b.title)?.ordinal || 0;
            return stageA - stageB;
        });

    return {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        tracking_code: candidate.tracking_code,
        progress_percent,
        timeline,
    };
};

// Placeholder for Printable Progress Sheet
export const generatePrintableSheet = async (trackingCode: string) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.tracking_code === trackingCode);
    if (!candidate) throw new Error("Candidate not found.");

    // We need the full detail to generate the sheet, so we fetch it using the ID
    const detail = await getCandidateDetail(candidate.id);
    if (!detail) throw new Error("Candidate detail not found.");

    // In a real app, this would generate a PDF/HTML view. Here we return the data.
    console.log(`[MOCK EXPORT] Generating printable sheet for ${detail.tracking_code}`);
    return detail;
};

// Placeholder for SMS/WhatsApp hook
export const sendNotification = async (type: 'sms' | 'whatsapp', recipient: string, message: string) => {
    console.log(`[MOCK NOTIFICATION] Sending ${type} to ${recipient}: ${message}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return { success: true };
};

// NEW: Mock API for sending candidate profile to foreign agency
export const sendProfileToForeignAgency = async (candidateId: string, trackingCode: string, foreignAgencyName: string) => {
    console.log(`[MOCK ACTION] Candidate ${trackingCode} (ID: ${candidateId}) profile sent to Foreign Agency: ${foreignAgencyName}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return { success: true, message: `Profile for ${trackingCode} successfully sent to ${foreignAgencyName}.` };
};