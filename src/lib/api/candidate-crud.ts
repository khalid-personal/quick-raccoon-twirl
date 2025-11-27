import { v4 as uuidv4 } from 'uuid';
import { Candidate, CandidateDetail } from '../types';
import { getCandidates, getCandidateStages, getMedicalResults, getDocuments, saveCandidates, saveCandidateStages } from '../data-store';
import { generateInitialStages } from '../data-seed';
import { isAdult } from '../utils-data';
import { getStageId } from './utils';

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

    return {
        ...candidate,
        stages: stages.sort((a, b) => {
            const stageA = getStageId(a.stage_id.toString())?.ordinal || 0;
            const stageB = getStageId(b.stage_id.toString())?.ordinal || 0;
            return stageA - stageB;
        }),
        medical_results,
        documents,
    };
};

// PATCH /api/admin/candidate/:id/details
export const updateCandidateDetails = async (candidateId: string, data: CandidateUpdateData): Promise<Candidate> => {
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
    return updatedCandidate;
};

// POST /api/admin/candidate
export const createCandidate = async (data: CandidateCreationData): Promise<Candidate> => {
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

// NEW: Update candidate credentials (email and password/pin)
export const updateCandidateCredentials = async (candidateId: string, newEmail: string, newPin?: string): Promise<Candidate> => {
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
    
    return updatedCandidate;
};