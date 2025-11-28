import { v4 as uuidv4 } from 'uuid';
import { Candidate, CandidateDetail, ALL_STAGES } from '../types'; // Added ALL_STAGES import
import { getCandidates, getCandidateStages, getMedicalResults, getDocuments, saveCandidates, saveCandidateStages, getChatMessages, getCocFacilities, getForeignAgencies, getLocalAgencies } from '../data-store'; // Import new getters
import { generateInitialStages } from '../data-seed';
import { isAdult } from '../utils-data';
import { getStageId } from './utils';
import { recordApprovalLog } from './log-management';

type CandidateCreationData = Omit<Candidate, 'id' | 'created_at' | 'updated_at'>;
type CandidateUpdateData = Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at'>>;

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
    actorId: string, // NEW PARAMETER for logging
    actorEmail: string // NEW PARAMETER for logging
): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const index = candidates.findIndex(c => c.id === candidateId);

    if (index === -1) {
        throw new Error('Candidate not found.');
    }

    const existingCandidate = candidates[index];

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
        if (candidates.some(c => c.tracking_code === newTrackingCode)) {
            throw new Error(`Tracking code '${newTrackingCode}' already exists.`);
        }
    }

    if (newPassportNumber && newPassportNumber !== existingCandidate.passport_number) {
        if (candidates.some(c => c.passport_number === newPassportNumber)) {
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
        updated_at: new Date().toISOString(),
    } as Candidate; // Cast back to Candidate to satisfy return type

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
    actorId: string, // NEW PARAMETER for logging
    actorEmail: string // NEW PARAMETER for logging
): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();

    // --- Duplicate Check for Creation ---
    if (candidates.some(c => c.tracking_code === data.tracking_code)) {
        throw new Error(`Tracking code '${data.tracking_code}' already exists.`);
    }
    if (candidates.some(c => c.passport_number === data.passport_number)) {
        throw new Error(`Passport number '${data.passport_number}' already exists.`);
    }
    if (candidates.some(c => c.email === data.email)) {
        throw new Error(`Email '${data.email}' already exists.`);
    }
    // --- End Duplicate Check ---

    // Age validation
    if (!isAdult(data.dob)) {
        throw new Error("Candidate must be 18 years or older.");
    }

    const newCandidate: Candidate = {
        ...data,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    } as Candidate; // Cast back to Candidate to satisfy return type

    candidates.push(newCandidate);
    saveCandidates(candidates);

    // Initialize stages for the new candidate
    const initialStages = generateInitialStages(newCandidate);
    const allStages = getCandidateStages();
    saveCandidateStages([...allStages, ...initialStages]);

    // --- LOGGING ---
    let description = `Created new candidate: ${newCandidate.first_name} ${newCandidate.last_name} (${newCandidate.tracking_code}).`;
    if (newCandidate.foreign_agency_id) description += ` Assigned to foreign agency ID: '${newCandidate.foreign_agency_id}'.`;
    if (newCandidate.local_agency_id) description += ` Assigned to local agency ID: '${newCandidate.local_agency_id}'.`;
    if (newCandidate.coc_facility_id) description += ` Assigned to COC facility ID: '${newCandidate.coc_facility_id}'.`;
    if (newCandidate.profile_image_url) description += ` Profile image uploaded.`;
    await recordApprovalLog(actorId, actorEmail, 'Candidate', newCandidate.id, 'Created', description);
    // --- END LOGGING ---

    return newCandidate;
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