import { v4 as uuidv4 } from 'uuid';
import { Candidate, CandidateStage, MedicalResult, Document, ALL_STAGES, StageStatus } from './types';

// --- Configuration Types ---
export interface AppConfig {
    countryOptions: string[];
}

// --- Seed Data Constants ---
const MOCK_FIRST_NAMES = ['Aisha', 'Bruk', 'Chala', 'Desta', 'Elias', 'Fana', 'Girma', 'Hana', 'Ismail', 'Jemal', 'Kalkidan', 'Lelisa', 'Marta', 'Nardos', 'Oumer'];
const MOCK_LAST_NAMES = ['Ahmed', 'Kebede', 'Mekonnen', 'Tadesse', 'Wondimu', 'Zewde', 'Ali', 'Hassan', 'Mohamed'];
const MOCK_COUNTRIES = ['Ethiopia', 'Djibouti', 'Kenya', 'Somalia', 'Eritrea', 'Sudan', 'Yemen', 'Uganda'];
const MOCK_MARITAL_STATUSES: Candidate['marital_status'][] = ['Single', 'Married', 'Divorced', 'Widowed'];
const TOTAL_NEW_CANDIDATES = 50;
const TOTAL_BATCHES = 13;

// Helper to find stage ID by slug
const getStageId = (slug: string) => ALL_STAGES.find(s => s.slug === slug)?.id;

// Existing seed candidates (3)
const EXISTING_SEED_CANDIDATES: Candidate[] = [
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Function to generate new mock candidates
const generateNewMockCandidates = (startId: number): Candidate[] => {
    const newCandidates: Candidate[] = [];
    let trackingCodeCounter = startId;

    for (let i = 0; i < TOTAL_NEW_CANDIDATES; i++) {
        const firstName = MOCK_FIRST_NAMES[i % MOCK_FIRST_NAMES.length];
        const lastName = MOCK_LAST_NAMES[i % MOCK_LAST_NAMES.length];
        const country = MOCK_COUNTRIES[i % MOCK_COUNTRIES.length];
        const countryCode = country.substring(0, 2).toUpperCase();
        const batchNumber = (i % TOTAL_BATCHES) + 1;
        const batchName = `Batch ${batchNumber}`;
        const maritalStatus = MOCK_MARITAL_STATUSES[i % MOCK_MARITAL_STATUSES.length];
        
        const trackingCode = `TRK-${countryCode}-${String(trackingCodeCounter++).padStart(4, '0')}`;
        
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - (18 + (i % 18)); 
        const dob = `${birthYear}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;

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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    }
    return newCandidates;
};

export const SEED_CANDIDATES: Candidate[] = [...EXISTING_SEED_CANDIDATES, ...generateNewMockCandidates(4)];

// Helper to generate initial stages for a candidate
export const generateInitialStages = (candidate: Candidate): CandidateStage[] => {
  const isAster = candidate.tracking_code === 'TRK-ET-0001';
  const isFatima = candidate.tracking_code === 'TRK-DJ-0003';
  
  const maxCompletedStages = Math.floor(Math.random() * (ALL_STAGES.length + 1));

  return ALL_STAGES.map((stage, index) => {
    const now = new Date().toISOString();
    let status: StageStatus = 'Pending';
    let date: string | undefined = undefined;
    let reference_id: string | undefined = undefined;

    // --- Specific Seed Logic for Existing Candidates ---
    if (isAster) {
      if (stage.slug === 'initial_medical') {
        status = 'Passed';
        date = '2025-11-10T00:00:00Z';
      } else if (stage.slug === 'labor_id') {
        status = 'Issued';
        date = '2025-11-20T00:00:00Z';
        reference_id = 'LID-12345';
      } else if (stage.slug === 'final_medical') {
        status = 'Passed';
        date = '2025-11-22T00:00:00Z';
      } else if (stage.slug === 'flight_departure') {
        status = 'In Progress';
        date = '2025-11-25T00:00:00Z';
      }
    } else if (isFatima) {
      if (stage.slug === 'initial_medical') {
        status = 'In Progress';
        date = '2025-12-01T00:00:00Z';
      }
    } 
    // --- Random Progress Logic for New Candidates ---
    else {
        if (index < maxCompletedStages) {
            status = 'Passed';
            const daysAgo = Math.floor(Math.random() * 60);
            date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(); 
            
            if (stage.slug === 'labor_id' && status === 'Passed') {
                status = 'Issued';
                reference_id = `LID-${Math.floor(10000 + Math.random() * 90000)}`;
            }
            
            if (Math.random() < 0.05 && index < ALL_STAGES.length - 1) {
                status = 'Failed';
            }
        } else if (index === maxCompletedStages && maxCompletedStages < ALL_STAGES.length) {
            status = 'In Progress';
        }
    }

    return {
      id: uuidv4(),
      candidate_id: candidate.id,
      stage_id: stage.id,
      status: status,
      notes: undefined,
      date: date,
      updated_at: now,
      reference_id: reference_id,
    };
  });
};

export const SEED_CANDIDATE_STAGES: CandidateStage[] = SEED_CANDIDATES.flatMap(candidate => generateInitialStages(candidate));

export const SEED_DOCUMENTS: Document[] = [
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[0].id,
    stage_id: getStageId('initial_medical'),
    file_name: 'aster_initial_medical.pdf',
    file_type: 'application/pdf',
    storage_key: 'docs/aster/initial_medical.pdf',
    uploaded_at: new Date().toISOString(),
    public_url: '/placeholder.svg',
  },
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[1].id,
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
    candidate_id: EXISTING_SEED_CANDIDATES[0].id,
    exam_type: 'HIV',
    status: 'Passed',
    exam_date: '2025-11-10',
    document_id: SEED_DOCUMENTS[0].id,
  },
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[0].id,
    exam_type: 'Final Agency Medical',
    status: 'Passed',
    exam_date: '2025-11-22',
  },
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[1].id,
    exam_type: 'Pregnancy',
    status: 'Pending',
    exam_date: '2025-11-12',
    document_id: SEED_DOCUMENTS[1].id,
  },
];

export const SEED_CONFIG: AppConfig = {
    countryOptions: ['Ethiopia', 'Djibouti', 'Somalia', 'Kenya', 'Eritrea', 'Sudan', 'Yemen', 'Uganda', 'Other'],
};