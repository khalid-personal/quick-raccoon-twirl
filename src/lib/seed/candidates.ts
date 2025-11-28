import { v4 as uuidv4 } from 'uuid';
import { Candidate, CandidateStage, MedicalResult, Document, ALL_STAGES, StageStatus } from '../types';
import { SEED_COC_FACILITIES } from './coc-facilities';
import { SEED_FOREIGN_AGENCIES } from './foreign-agencies';
import { SEED_LOCAL_AGENCIES } from './local-agencies';

// --- Helper function to find stage ID by slug ---
const getStageId = (slug: string) => ALL_STAGES.find(s => s.slug === slug)?.id;

// --- Helper function to generate initial stages for a new candidate ---
export function generateInitialStages(candidate: Candidate): CandidateStage[] {
    return ALL_STAGES.map(stage => ({
        id: uuidv4(),
        candidate_id: candidate.id,
        stage_id: stage.id,
        status: 'Pending' as StageStatus,
        notes: undefined,
        date: undefined,
        updated_at: new Date().toISOString(),
        reference_id: undefined,
    }));
}

// --- Seed Data Constants ---
const MOCK_FIRST_NAMES = ['Aisha', 'Bruk', 'Chala', 'Desta', 'Elias', 'Fana', 'Girma', 'Hana', 'Ismail', 'Jemal', 'Kalkidan', 'Lelisa', 'Marta', 'Nardos', 'Oumer'];
const MOCK_LAST_NAMES = ['Ahmed', 'Kebede', 'Mekonnen', 'Tadesse', 'Wondimu', 'Zewde', 'Ali', 'Hassan', 'Mohamed'];
const MOCK_COUNTRIES = ['Ethiopia', 'Djibouti', 'Kenya', 'Somalia', 'Eritrea', 'Sudan', 'Yemen', 'Uganda'];
const MOCK_MARITAL_STATUSES: Candidate['marital_status'][] = ['Single', 'Married', 'Divorced', 'Widowed'];
const TOTAL_NEW_RANDOM_CANDIDATES = 5; // Changed from 50 to 5
const TOTAL_BATCHES = 4; // Defined TOTAL_BATCHES here

// Existing seed candidates (3) + 2 new specific ones = 5 specific candidates
const SPECIFIC_SEED_CANDIDATES: Candidate[] = [
  {
    id: uuidv4(),
    first_name: 'Aster',
    last_name: 'Bekele',
    dob: '1997-05-14',
    passport_number: 'EP1234567',
    tracking_code: 'TRK-ET-0001',
    country_of_origin: 'Ethiopia',
    batch_name: 'Batch 1',
    marital_status: 'Married',
    phone_number: '+251911000001',
    email: 'aster.bekele@candidate.com', // Added email
    coc_facility_id: SEED_COC_FACILITIES[0].id, // Assigned a COC facility ID
    foreign_agency_id: SEED_FOREIGN_AGENCIES[0].id, // Assigned a foreign agency ID
    local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'NuraLink')!.id, // Assigned a managing local agency ID
    profile_image_url: '/placeholder.svg', // NEW MOCK IMAGE
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(), // 3 months ago
    updated_at: new Date().toISOString(),
    payment_status: 'paid', // NEW: Set initial payment status
    last_payment_id: undefined, // Will be linked by payment seed
  },
  {
    id: uuidv4(),
    first_name: 'Mariam',
    last_name: 'Tesfaye',
    dob: '2000-07-22',
    passport_number: 'EP9876543',
    tracking_code: 'TRK-ET-0002',
    country_of_origin: 'Ethiopia',
    batch_name: 'Batch 1',
    marital_status: 'Single',
    phone_number: '+251911000002',
    email: 'mariam.tesfaye@candidate.com', // Added email
    coc_facility_id: SEED_COC_FACILITIES[1].id, // Assigned a COC facility ID
    foreign_agency_id: SEED_FOREIGN_AGENCIES[1].id, // Assigned a foreign agency ID
    local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'Local Agency X')!.id, // Assigned a managing local agency ID
    profile_image_url: '/placeholder.svg', // NEW MOCK IMAGE
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(), // 1.5 months ago
    updated_at: new Date().toISOString(),
    payment_status: 'pending_payment', // NEW: Set initial payment status
    last_payment_id: undefined, // Will be linked by payment seed
  },
  {
    id: uuidv4(),
    first_name: 'Fatima',
    last_name: 'Ali',
    dob: '2000-01-01',
    passport_number: 'DJ000111',
    tracking_code: 'TRK-DJ-0003',
    country_of_origin: 'Djibouti',
    batch_name: 'Batch 2',
    marital_status: 'Divorced',
    phone_number: '+25377000003',
    email: 'fatima.ali@candidate.com', // Added email
    coc_facility_id: SEED_COC_FACILITIES[2].id, // Assigned a COC facility ID
    foreign_agency_id: SEED_FOREIGN_AGENCIES[2].id, // Assigned a foreign agency ID
    local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'Local Agency Y')!.id, // Assigned a managing local agency ID
    profile_image_url: undefined, // No image for this one
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(), // 15 days ago
    updated_at: new Date().toISOString(),
    payment_status: 'unpaid', // NEW: Set initial payment status
    last_payment_id: undefined,
  },
  // NEW SPECIFIC CANDIDATE 4: NuraLink, In Progress
  {
    id: uuidv4(),
    first_name: 'Nura',
    last_name: 'Mohammed',
    dob: '1999-03-10',
    passport_number: 'ETN000004',
    tracking_code: 'TRK-ET-0004',
    country_of_origin: 'Ethiopia',
    batch_name: 'Batch 3',
    marital_status: 'Single',
    phone_number: '+251911000004',
    email: 'nura.mohammed@candidate.com',
    coc_facility_id: SEED_COC_FACILITIES[3].id,
    foreign_agency_id: SEED_FOREIGN_AGENCIES[1].id,
    local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'NuraLink')!.id,
    profile_image_url: '/placeholder.svg',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    payment_status: 'pending_payment', // NEW: Set initial payment status
    last_payment_id: undefined, // Will be linked by payment seed
  },
  // NEW SPECIFIC CANDIDATE 5: Al-Aman, Completed
  {
    id: uuidv4(),
    first_name: 'Khalid',
    last_name: 'Hassan',
    dob: '1995-11-20',
    passport_number: 'ETK000005',
    tracking_code: 'TRK-ET-0005',
    country_of_origin: 'Ethiopia',
    batch_name: 'Batch 4',
    marital_status: 'Married',
    phone_number: '+251911000005',
    email: 'khalid.hassan@candidate.com',
    coc_facility_id: SEED_COC_FACILITIES[0].id,
    foreign_agency_id: SEED_FOREIGN_AGENCIES[0].id,
    local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'Local Agency Z')!.id,
    profile_image_url: undefined,
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    payment_status: 'paid', // NEW: Set initial payment status
    last_payment_id: undefined,
  },
];

// Function to generate new mock candidates
const generateNewMockCandidates = (startId: number): Candidate[] => {
    const newCandidates: Candidate[] = [];
    let trackingCodeCounter = startId;

    for (let i = 0; i < TOTAL_NEW_RANDOM_CANDIDATES; i++) { // Use TOTAL_NEW_RANDOM_CANDIDATES
        const firstName = MOCK_FIRST_NAMES[i % MOCK_FIRST_NAMES.length];
        const lastName = MOCK_LAST_NAMES[i % MOCK_LAST_NAMES.length];
        const country = MOCK_COUNTRIES[i % MOCK_COUNTRIES.length];
        const countryCode = country.substring(0, 2).toUpperCase();
        const batchNumber = (i % TOTAL_BATCHES) + 1;
        const batchName = `Batch ${batchNumber}`;
        const maritalStatus = MOCK_MARITAL_STATUSES[i % MOCK_MARITAL_STATUSES.length];
        
        // Assign IDs from seeded lists
        const cocFacility = SEED_COC_FACILITIES[i % SEED_COC_FACILITIES.length];
        const foreignAgency = SEED_FOREIGN_AGENCIES[i % SEED_FOREIGN_AGENCIES.length]; 
        const localAgency = SEED_LOCAL_AGENCIES[i % SEED_LOCAL_AGENCIES.length];
        
        const trackingCode = `TRK-${countryCode}-${String(trackingCodeCounter++).padStart(4, '0')}`;
        
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - (18 + (i % 18)); 
        const dob = `${birthYear}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
        
        const mockPhoneNumber = `+${Math.floor(100 + Math.random() * 900)}${String(Math.floor(10000000 + Math.random() * 90000000))}`;
        const mockEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${trackingCodeCounter}@candidate.com`;
        
        // Distribute creation dates over the last 6 months
        const daysAgo = Math.floor(Math.random() * 180);
        const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();


        newCandidates.push({
            id: uuidv4(),
            first_name: firstName,
            last_name: lastName,
            dob: dob,
            passport_number: `P${Math.floor(1000000 + Math.random() * 9000000)}`,
            tracking_code: trackingCode,
            country_of_origin: country,
            batch_name: batchName,
            marital_status: maritalStatus,
            phone_number: mockPhoneNumber,
            email: mockEmail, // Added email
            coc_facility_id: cocFacility.id,
            foreign_agency_id: foreignAgency.id, // NEW
            local_agency_id: localAgency.id, // NEW
            profile_image_url: i % 5 === 0 ? '/placeholder.svg' : undefined, // Randomly assign image
            created_at: createdAt,
            updated_at: new Date().toISOString(),
            payment_status: 'unpaid', // Default for new random candidates
            last_payment_id: undefined,
        });
    }
    return newCandidates;
};

export const SEED_CANDIDATES: Candidate[] = [...SPECIFIC_SEED_CANDIDATES, ...generateNewMockCandidates(SPECIFIC_SEED_CANDIDATES.length + 1)]; // Start ID for random candidates

// --- Custom Stage Progression for Seed Data ---
const initialMedicalId = getStageId('initial_medical');
const cocTrainingId = getStageId('coc_training');
const securityClearanceId = getStageId('security_clearance');
const laborId = getStageId('labor_id');
const contractSigningId = getStageId('contract_signing');
const finalElmisClearanceId = getStageId('final_elmis_clearance'); // NEW ID 6
const jobMatchingId = getStageId('job_matching');
const visaProcessingId = getStageId('visa_processing');
const finalMedicalId = getStageId('final_medical');
const pdoId = getStageId('pdo');
const flightDepartureId = getStageId('flight_departure');

export const SEED_CANDIDATE_STAGES: CandidateStage[] = SEED_CANDIDATES.flatMap(candidate => {
    const stages = generateInitialStages(candidate);
    
    // Candidate 1 (Aster Bekele - TRK-ET-0001): Advanced, stuck at Final Medical
    if (candidate.tracking_code === 'TRK-ET-0001') {
        stages.find(s => s.stage_id === initialMedicalId)!.status = 'Passed';
        stages.find(s => s.stage_id === cocTrainingId)!.status = 'Passed';
        stages.find(s => s.stage_id === laborId)!.status = 'Issued'; // Labor ID is now stage 3
        stages.find(s => s.stage_id === securityClearanceId)!.status = 'Passed'; // Security Clearance is now stage 4
        stages.find(s => s.stage_id === jobMatchingId)!.status = 'Passed'; // Job Matching is now stage 5
        stages.find(s => s.stage_id === contractSigningId)!.status = 'Passed'; // Contract Signing is now stage 6
        stages.find(s => s.stage_id === finalElmisClearanceId)!.status = 'Passed'; // NEW STAGE (Replaced Biometrics)
        stages.find(s => s.stage_id === visaProcessingId)!.status = 'Issued';
        stages.find(s => s.stage_id === finalMedicalId)!.status = 'Pending'; // Stuck here
    } 
    // Candidate 2 (Mariam Tesfaye - TRK-ET-0002): Stuck at CoC Training
    else if (candidate.tracking_code === 'TRK-ET-0002') {
        stages.find(s => s.stage_id === initialMedicalId)!.status = 'Passed';
        stages.find(s => s.stage_id === cocTrainingId)!.status = 'In Progress'; // Stuck here
    }
    // Candidate 3 (Fatima Ali - TRK-DJ-0003): Blocked at Security Clearance
    else if (candidate.tracking_code === 'TRK-DJ-0003') {
        stages.find(s => s.stage_id === initialMedicalId)!.status = 'Passed';
        stages.find(s => s.stage_id === cocTrainingId)!.status = 'Passed';
        stages.find(s => s.stage_id === laborId)!.status = 'Passed'; // Passed Labor ID
        stages.find(s => s.stage_id === securityClearanceId)!.status = 'Failed'; // Blocked here
    }
    // Candidate 4 (Nura Mohammed - TRK-ET-0004): NuraLink, In Progress at Job Matching
    else if (candidate.tracking_code === 'TRK-ET-0004') {
        stages.find(s => s.stage_id === initialMedicalId)!.status = 'Passed';
        stages.find(s => s.stage_id === cocTrainingId)!.status = 'Passed';
        stages.find(s => s.stage_id === laborId)!.status = 'Issued';
        stages.find(s => s.stage_id === securityClearanceId)!.status = 'Passed';
        stages.find(s => s.stage_id === jobMatchingId)!.status = 'In Progress'; // Stuck here
    }
    // Candidate 5 (Khalid Hassan - TRK-ET-0005): Al-Aman, Completed
    else if (candidate.tracking_code === 'TRK-ET-0005') {
        ALL_STAGES.forEach(stage => {
            const candidateStage = stages.find(s => s.stage_id === stage.id);
            if (candidateStage) {
                candidateStage.status = 'Completed';
                candidateStage.date = new Date().toISOString();
            }
        });
    }
    // Other candidates: Randomly progress them to various stages
    else {
        const progressLevel = Math.floor(Math.random() * ALL_STAGES.length);
        for (let i = 0; i < progressLevel; i++) {
            const stage = ALL_STAGES[i];
            const candidateStage = stages.find(s => s.stage_id === stage.id);
            if (candidateStage) {
                // 70% chance of passing, 30% chance of being In Progress/Pending at the current level
                if (i < progressLevel - 1 || Math.random() < 0.7) {
                    candidateStage.status = 'Passed';
                } else {
                    candidateStage.status = Math.random() > 0.5 ? 'In Progress' : 'Pending';
                }
            }
        }
    }
    
    return stages;
});

export const SEED_DOCUMENTS: Document[] = [
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[0].id,
    stage_id: getStageId('initial_medical'),
    file_name: 'aster_initial_medical.pdf',
    file_type: 'application/pdf',
    storage_key: 'docs/aster/initial_medical.pdf',
    uploaded_at: new Date().toISOString(),
    public_url: '/placeholder.svg',
  },
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[1].id,
    stage_id: getStageId('initial_medical'),
    file_name: 'mariam_initial_medical.pdf',
    file_type: 'application/pdf',
    storage_key: 'docs/mariam/initial_medical.pdf',
    uploaded_at: new Date().toISOString(),
    public_url: '/placeholder.svg',
  },
];

export const SEED_MEDICAL_RESULTS: MedicalResult[] = [
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[0].id,
    exam_type: 'HIV',
    status: 'Passed',
    exam_date: '2025-11-10',
    document_id: SEED_DOCUMENTS[0].id,
  },
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[0].id,
    exam_type: 'Final Agency Medical',
    status: 'Passed',
    exam_date: '2025-11-22',
  },
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[1].id,
    exam_type: 'Pregnancy',
    status: 'Pending',
    exam_date: '2025-11-12',
    document_id: SEED_DOCUMENTS[1].id,
  },
];