import { Candidate, CandidateDetail, ALL_STAGES } from '../types'; // Added ALL_STAGES import
import { getCandidates, getCandidateStages, getMedicalResults, getDocuments, saveCandidates, getChatMessages, getCocFacilities, getForeignAgencies, getLocalAgencies, getStaffUsers } from '../data-store'; // Import new getters
import { isAdult } from '../utils-data';
import { getStageId } from './utils';
import { recordApprovalLog } from './log-management';
import { hasCompleteCandidateIntroduction } from '../candidate-introduction';
import { requireAgencyOperations } from '../agency-resolution';
import { getApiPrincipal } from './auth';
import { matchPassportCandidate, MINISTRY_INTAKE_MESSAGE, MINISTRY_PROFILE_FIELDS, MINISTRY_PROFILE_MESSAGE, MINISTRY_JOURNEY_FIELDS, MINISTRY_STAGE_MESSAGE, normalizeIdentity } from '../ministry-candidates';

type CandidateCreationData = Omit<Candidate, 'id' | 'created_at' | 'updated_at' | 'payment_status' | 'last_payment_id'>;
type CandidateUpdateData = Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at' | 'payment_status' | 'last_payment_id'>>;

// GET /api/admin/candidate/:id
export const getCandidateDetail = async (candidateId: string): Promise<CandidateDetail | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.id === candidateId);
    if (!candidate) return null;

    const stages = getCandidateStages().filter(cs => cs.candidate_id === candidate.id);
    const medical_results = getMedicalResults().filter(mr => mr.candidate_id === candidate.id);
    const documents = getDocuments().filter(d => d.candidate_id === candidate.id);
    const chat_messages = getChatMessages().filter(m => m.candidate_id === candidate.id);

    const cocFacility = candidate.coc_facility_id ? getCocFacilities().find(cf => cf.id === candidate.coc_facility_id) : undefined;
    const foreignAgency = candidate.foreign_agency_id ? getForeignAgencies().find(fa => fa.id === candidate.foreign_agency_id) : undefined;
    const localAgency = candidate.local_agency_id ? getLocalAgencies().find(la => la.id === candidate.local_agency_id) : undefined;

    return {
        ...candidate,
        stages: stages.sort((a, b) => {
            const stageA = ALL_STAGES.find(s => s.id === a.stage_id)?.ordinal || 0;
            const stageB = ALL_STAGES.find(s => s.id === b.stage_id)?.ordinal || 0;
            return stageA - stageB;
        }),
        medical_results,
        documents,
        chat_messages,
        coc_facility_name: cocFacility?.name,
        foreign_agency_name: foreignAgency?.name,
        local_agency_name: localAgency?.name,
    };
};

// NEW: GET /api/admin/candidate/by-tracking-code/:trackingCode
export const getCandidateDetailByTrackingCode = async (trackingCode: string): Promise<CandidateDetail | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.tracking_code.toLowerCase() === trackingCode.toLowerCase());
    if (!candidate) return null;
    
    return getCandidateDetail(candidate.id);
};

// PATCH /api/admin/candidate/:id/details
export const updateCandidateDetails = async (
    candidateId: string, 
    data: CandidateUpdateData,
    actorId: string,
    actorEmail: string
): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const index = candidates.findIndex(c => c.id === candidateId);

    if (index === -1) {
        throw new Error('Candidate not found.');
    }

    const existingCandidate = candidates[index];
    if (MINISTRY_JOURNEY_FIELDS.some(field => field in data && JSON.stringify(data[field]) !== JSON.stringify(existingCandidate[field]))) {
      throw new Error(MINISTRY_STAGE_MESSAGE);
    }
    if (([...MINISTRY_PROFILE_FIELDS, 'tracking_code'] as const).some(field => field in data && JSON.stringify(data[field]) !== JSON.stringify(existingCandidate[field]))) {
      throw new Error(MINISTRY_PROFILE_MESSAGE);
    }
    if (data.gender !== undefined && data.gender !== 'male' && data.gender !== 'female') {
        throw new Error('Candidate gender must be male or female.');
    }
    if (!hasCompleteCandidateIntroduction({ ...existingCandidate, ...data })) {
        throw new Error('Candidate gender, introduction, skills, languages, and introduction video are required.');
    }

    // Age validation: Check if DOB is provided and if the person is 18+
    const dobToCheck = data.dob ?? existingCandidate.dob;
    if (!isAdult(dobToCheck)) {
        throw new Error("Candidate must be 18 years or older.");
    }

    // --- Duplicate Check for Updates ---
    const newTrackingCode = data.tracking_code;
    const newPassportNumber = data.passport_number;
    const newEmail = data.email;

    if (newTrackingCode && newTrackingCode !== existingCandidate.tracking_code) {
        if (candidates.some(c => c.id !== candidateId && c.tracking_code.trim().toUpperCase() === newTrackingCode.trim().toUpperCase())) {
            throw new Error(`Tracking code '${newTrackingCode}' already exists.`);
        }
    }

    if (newPassportNumber && newPassportNumber !== existingCandidate.passport_number) {
        if (candidates.some(c => c.id !== candidateId && normalizeIdentity(c.passport_number) === normalizeIdentity(newPassportNumber))) {
            throw new Error(`Passport number '${newPassportNumber}' already exists.`);
        }
    }

    if (newEmail && newEmail !== existingCandidate.email) {
        if (candidates.some(c => c.email === newEmail)) {
            throw new Error(`Email '${newEmail}' already exists.`);
        }
    }
    // --- End Duplicate Check ---

    const updatedCandidate: Candidate = {
        ...existingCandidate,
        ...data,
        tracking_code: (data.tracking_code ?? existingCandidate.tracking_code).trim().toUpperCase(),
        updated_at: new Date().toISOString(),
    } as Candidate; // Cast back to Candidate to satisfy return type
    if (updatedCandidate.local_agency_id !== existingCandidate.local_agency_id || updatedCandidate.foreign_agency_id !== existingCandidate.foreign_agency_id) {
      requireAgencyOperations('local', existingCandidate.local_agency_id);
      requireAgencyOperations('foreign', existingCandidate.foreign_agency_id);
      requireAgencyOperations('local', updatedCandidate.local_agency_id);
      requireAgencyOperations('foreign', updatedCandidate.foreign_agency_id);
    }
    if (updatedCandidate.local_agency_id !== existingCandidate.local_agency_id) {
      throw new Error('The managing local agency comes from the ministry record. Request an ELMIS correction instead.');
    }
    if ('elmis' in data && JSON.stringify(data.elmis) !== JSON.stringify(existingCandidate.elmis)) {
      throw new Error('Ministry identity and Labor ID details can only be updated through ELMIS.');
    }

    candidates[index] = updatedCandidate;
    saveCandidates(candidates);

    // --- LOGGING ---
    let description = `Updated candidate details for ${existingCandidate.tracking_code}.`;
    // Add more detailed logging based on what fields changed
    if (data.first_name !== existingCandidate.first_name) description += ` First name changed to '${data.first_name}'.`;
    if (data.last_name !== existingCandidate.last_name) description += ` Last name changed to '${data.last_name}'.`;
    if (data.passport_number !== existingCandidate.passport_number) description += ` Passport changed to '${data.passport_number}'.`;
    if (data.foreign_agency_id !== existingCandidate.foreign_agency_id) description += ` Foreign agency ID changed to '${data.foreign_agency_id || 'N/A'}'.`;
    if (data.local_agency_id !== existingCandidate.local_agency_id) description += ` Local agency ID changed to '${data.local_agency_id || 'N/A'}'.`;
    if (data.coc_facility_id !== existingCandidate.coc_facility_id) description += ` COC facility ID changed to '${data.coc_facility_id || 'N/A'}'.`;
    if (data.profile_image_url !== existingCandidate.profile_image_url) description += ` Profile image URL updated.`;


    await recordApprovalLog(actorId, actorEmail, 'Candidate', candidateId, 'Updated', description);
    // --- END LOGGING ---

    return updatedCandidate;
};

// POST /api/admin/candidate
export const createCandidate = async (
    data: CandidateCreationData,
    _actorId: string,
    _actorEmail: string
): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    requireAgencyOperations('local', data.local_agency_id);
    requireAgencyOperations('foreign', data.foreign_agency_id);
    throw new Error(MINISTRY_INTAKE_MESSAGE);
};

export const attachCandidatePassport = async (
    scan: { data: NonNullable<Candidate['passport_identity']> & Partial<Pick<Candidate, 'passport_nationality' | 'passport_issuing_country' | 'passport_expiry_date' | 'passport_document_type'>>; imageUrl: string; screeningReport: NonNullable<Candidate['passport_image_scan_report']> },
): Promise<Candidate> => {
    const principal = await getApiPrincipal();
    if (!['superadmin', 'admin', 'staff', 'local-agency'].includes(principal.role)) throw new Error('Your account cannot attach candidate passports.');
    if (!scan.imageUrl || scan.screeningReport.status === 'blocked') throw new Error('A usable screened passport upload is required.');
    const candidates = getCandidates();
    const candidate = matchPassportCandidate(candidates, scan.data.passport_number);
    if (principal.role === 'local-agency' && (!principal.localAgencyId || candidate.local_agency_id !== principal.localAgencyId)
      || principal.role === 'staff' && (principal.localAgencyId && candidate.local_agency_id !== principal.localAgencyId
        || candidate.assigned_staff_id !== principal.id && !getCandidateStages().some(stage => stage.candidate_id === candidate.id && stage.assigned_staff_id === principal.id))) {
      throw new Error('This candidate is not assigned to your account or agency.');
    }
    const updated: Candidate = { ...candidate,
      passport_identity: { first_name: scan.data.first_name, last_name: scan.data.last_name, dob: scan.data.dob, passport_number: scan.data.passport_number, gender: scan.data.gender,
        passport_nationality: scan.data.passport_nationality, passport_issuing_country: scan.data.passport_issuing_country,
        passport_expiry_date: scan.data.passport_expiry_date, passport_document_type: scan.data.passport_document_type },
      passport_image_url: scan.imageUrl, passport_image_scan_report: scan.screeningReport,
      updated_at: new Date().toISOString() };
    saveCandidates(candidates.map(item => item.id === candidate.id ? updated : item));
    await recordApprovalLog(principal.id, getStaffUsers().find(person => person.id === principal.id)?.email ?? principal.id, 'Candidate', candidate.id, 'Updated',
      `Passport attached to ${candidate.first_name} ${candidate.last_name} (${candidate.tracking_code}). Original identity and agency assignment retained; scanned details are available for record checks.`);
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    return updated;
};

// Helper to get candidate by email (needed after Supabase login)
export const getCandidateByEmail = async (email: string): Promise<Candidate | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    return candidates.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
};

// NEW: Helper to get candidate by tracking code
export const getCandidateByTrackingCode = async (trackingCode: string): Promise<Candidate | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    return candidates.find(c => c.tracking_code.toLowerCase() === trackingCode.toLowerCase()) || null;
};

// NEW: Get a random candidate for testing
export const getRandomCandidate = async (): Promise<{ identifier: string, pin: string }> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    if (candidates.length === 0) {
        throw new Error("No candidates available in the mock database.");
    }
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const candidate = candidates[randomIndex];
    
    // Return tracking code for identifier and mock PIN
    return {
        identifier: candidate.tracking_code,
        pin: '123456' // Mock PIN
    };
};

// NEW: Update candidate credentials (email and password/pin)
export const updateCandidateCredentials = async (
    candidateId: string, 
    newEmail: string, 
    newPin?: string,
    actorId?: string, // NEW PARAMETER for logging
    actorEmail?: string // NEW PARAMETER for logging
): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const index = candidates.findIndex(c => c.id === candidateId);

    if (index === -1) {
        throw new Error('Candidate not found.');
    }
    
    const existingCandidate = candidates[index];

    if (newEmail !== existingCandidate.email) throw new Error(MINISTRY_PROFILE_MESSAGE);
    // Check for duplicate email if changing
    if (newEmail.toLowerCase() !== existingCandidate.email.toLowerCase() && candidates.some(c => c.email.toLowerCase() === newEmail.toLowerCase())) {
        throw new Error(`Email '${newEmail}' is already registered by another candidate.`);
    }

    const updatedCandidate = {
        ...existingCandidate,
        email: newEmail,
        // NOTE: In a real Supabase app, we would call:
        // await supabase.auth.admin.updateUserById(candidateId, { email: newEmail, password: newPin });
        // Since we are mocking, we just update the email in the mock store.
        // The PIN change is purely simulated here.
    };

    candidates[index] = updatedCandidate;
    saveCandidates(candidates);
    
    // --- LOGGING ---
    if (actorId && actorEmail) {
        let description = `Updated login credentials for candidate ${existingCandidate.tracking_code}.`;
        if (newEmail !== existingCandidate.email) description += ` Email changed from '${existingCandidate.email}' to '${newEmail}'.`;
        if (newPin) description += ` PIN reset.`;
        await recordApprovalLog(actorId, actorEmail, 'Candidate', candidateId, 'Updated', description);
    }
    // --- END LOGGING ---

    return updatedCandidate;
};