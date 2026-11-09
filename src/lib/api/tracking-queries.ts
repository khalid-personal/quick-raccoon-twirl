import {
    PublicTrackingData,
    ALL_STAGES,
    StageStatus,
} from '../types';
import { getCandidates, saveCandidates, getCandidateStages, getMedicalResults, getDocuments, getPaymentStatuses, getPayments, getCocFacilities, getForeignAgencies, getLocalAgencies, getConfig } from '../data-store'; // Import new getters
import { stageFeeCovered } from '../stage-readiness';
import { normalizePartnerships, recordProfileShare } from '../agency-partnerships';
import { calculateProgress } from '../utils-data';
import { getStageId } from './utils';
import { getCandidateDetail } from './candidate-crud';
import { recordApprovalLog } from './log-management'; // NEW IMPORT
import { facilityCoordinates, findCity, findDestination } from '../ethiopia';
import { hasCompleteCandidateIntroduction } from '../candidate-introduction';
import { requireAgencyOperations } from '../agency-resolution';

// GET /api/track/:tracking_code
export const getPublicTrackingData = async (trackingCode: string): Promise<PublicTrackingData | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.tracking_code === trackingCode);
    if (!candidate) return null;

    const stages = getCandidateStages().filter(cs => cs.candidate_id === candidate.id);
    const medicalResults = getMedicalResults().filter(mr => mr.candidate_id === candidate.id);
    const paymentStatuses = getPaymentStatuses(); // Get mock payment statuses
    const cocFacilities = getCocFacilities();
    const foreignAgencies = getForeignAgencies();
    const localAgencies = getLocalAgencies();
    const stageFees = getConfig().stageFees ?? {};

    const progress_percent = calculateProgress(stages);

    const timeline = stages
        .map(cs => {
            const stage = ALL_STAGES.find(s => s.id === cs.stage_id) ?? {
                id: cs.stage_id,
                slug: `legacy-stage-${cs.stage_id}`,
                title: `Legacy stage ${cs.stage_id}`,
                ordinal: cs.stage_id,
                icon: '',
            };

            let medical_status_summary: StageStatus | undefined = undefined;
            const is_medical_stage = stage.slug === 'medical';

            // Determine payment status
            const is_fee_paid = stageFeeCovered(candidate, stage.id, stageFees, paymentStatuses, getPayments());

            if (is_medical_stage) {
                // Summarize medical results for public view (Rule: only show Pass/Fail/Pending)
                const relevantResults = medicalResults;

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
                is_medical_stage,
                // Use the calculated summary if it's a medical stage, otherwise use the stage status
                medical_status_summary: medical_status_summary || cs.status,
                documents: [],
                fee_amount: stageFees[stage.id] ?? stage.fee_amount,
                is_fee_paid: is_fee_paid, // Include payment status
            };
        })
        .sort((a, b) => {
            const stageA = ALL_STAGES.find(s => s.title === a.title)?.ordinal || 0;
            const stageB = ALL_STAGES.find(s => s.title === b.title)?.ordinal || 0;
            return stageA - stageB;
        });

    const cocFacility = candidate.coc_facility_id ? cocFacilities.find(cf => cf.id === candidate.coc_facility_id) : undefined;
    const foreignAgency = candidate.foreign_agency_id ? foreignAgencies.find(fa => fa.id === candidate.foreign_agency_id) : undefined;
    const localAgency = candidate.local_agency_id ? localAgencies.find(la => la.id === candidate.local_agency_id) : undefined;
    const home = findCity(candidate.home_city);
    const facility = cocFacility ? facilityCoordinates(cocFacility) : null;
    const destination = candidate.external_status?.work_contract
        ? findDestination(candidate.external_status.destination_city, candidate.external_status.destination_country)
        : null;
    const journey: PublicTrackingData['journey'] = {
        home_city: candidate.home_city,
        home_region: candidate.home_region,
        home: home ? { lat: home.lat, lon: home.lon, label: home.name } : undefined,
        facility: facility && cocFacility ? { ...facility, label: cocFacility.name } : undefined,
        center: cocFacility ? {
            name: cocFacility.name, city: cocFacility.city, address: cocFacility.address,
            phone_number: cocFacility.phone_number, contact_email: cocFacility.contact_email,
            lat: facility?.lat, lon: facility?.lon,
            gps_url: facility ? `https://www.google.com/maps/search/?api=1&query=${facility.lat},${facility.lon}` : undefined,
        } : undefined,
        training_status: stages.find(stage => stage.stage_id === getStageId('training')?.id)?.status,
        destination: destination ?? undefined,
        deployment_status: candidate.arrival?.arrived_at ? 'Completed' : stages.find(stage => stage.stage_id === getStageId('deployment')?.id)?.status,
        arrived_at: candidate.arrival?.arrived_at,
    };

    return {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        tracking_code: candidate.tracking_code,
        progress_percent,
        timeline,
        journey,
        coc_facility_name: cocFacility?.name, // NEW
        foreign_agency_name: foreignAgency?.name, // NEW
        local_agency_name: localAgency?.name, // NEW
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
    console.log(`[PLACEHOLDER EXPORT] Generating printable sheet for ${detail.tracking_code}`);
    return detail;
};

// Placeholder for SMS/WhatsApp hook
export const sendNotification = async (type: 'sms' | 'whatsapp', recipient: string, message: string) => {
    console.log(`[PLACEHOLDER NOTIFICATION] Sending ${type} to ${recipient}: ${message}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return { success: true };
};

export const sendProfileToForeignAgency = async (
    candidateId: string, 
    trackingCode: string, 
    foreignAgencyName: string,
    actorId: string, // NEW PARAMETER
    actorEmail: string // NEW PARAMETER
) => {
    const candidates = getCandidates();
    const index = candidates.findIndex(candidate => candidate.id === candidateId && candidate.tracking_code === trackingCode);
    if (index < 0) throw new Error('Candidate not found.');
    const agency = getForeignAgencies().find(item => item.id === foreignAgencyName || item.name === foreignAgencyName);
    if (!agency) throw new Error('Foreign agency not found.');
    const candidate = candidates[index];
    requireAgencyOperations('local', candidate.local_agency_id);
    requireAgencyOperations('foreign', agency.id);
    if (!hasCompleteCandidateIntroduction(candidate)) {
        throw new Error('Complete the candidate gender, introduction, skills, languages, and introduction video before sharing the profile.');
    }
    const partnerships = normalizePartnerships(getConfig().agencyPartnerships);
    if (!partnerships.some(item => item.local_agency_id === candidate.local_agency_id && item.foreign_agency_id === agency.id && item.status === 'active')) {
        throw new Error('An active agency contract is required before sending this profile.');
    }
    candidates[index] = recordProfileShare(candidate, agency.id, actorEmail);
    saveCandidates(candidates);
    await recordApprovalLog(actorId, actorEmail, 'Candidate', candidateId, 'Updated', `Sent profile to foreign agency: ${agency.name}`);
    return { success: true, message: `Profile for ${trackingCode} sent to ${agency.name}.` };
};