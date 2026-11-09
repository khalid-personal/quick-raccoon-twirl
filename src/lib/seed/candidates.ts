import { v4 as uuidv4 } from 'uuid';
import { Candidate, CandidateStage, MedicalResult, Document, ALL_STAGES, StageStatus } from '../types';

// --- Updated getStageId to handle missing slugs ---
const getStageId = (slug: string) => {
  const stage = ALL_STAGES.find(s => s.slug === slug);
  return stage?.id;
};

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
const MOCK_COUNTRIES = ['Ethiopia'];
const MOCK_MARITAL_STATUSES: Candidate['marital_status'][] = ['Single', 'Married', 'Divorced', 'Widowed'];
const TOTAL_NEW_RANDOM_CANDIDATES = 5; // Changed from 50 to 5
const TOTAL_BATCHES = 4; // Defined TOTAL_BATCHES here

// Populate SPECIFIC_SEED_CANDIDATES with mock data
const SPECIFIC_SEED_CANDIDATES: Candidate[] = [
  {
    id: uuidv4(),
    first_name: 'John',
    last_name: 'Doe',
    dob: '1998-04-12',
    passport_number: 'ET0000001',
    marital_status: 'Single',
    gender: 'male',
    country_of_origin: 'Ethiopia',
    tracking_code: 'TRK-ET-0001',
    professional_summary: 'Demo profile for validating the candidate registration workflow.',
    skills: ['Household organization', 'Cleaning routines'],
    languages: ['Amharic', 'English'],
    intro_video_url: '/demo-intros/illustrative-introduction.mp4',
    email: 'john.doe@example.test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    payment_status: 'unpaid',
  },
  {
    id: uuidv4(),
    first_name: 'Jane',
    last_name: 'Smith',
    dob: '1997-08-03',
    passport_number: 'ET0000002',
    marital_status: 'Married',
    gender: 'female',
    country_of_origin: 'Ethiopia',
    tracking_code: 'TRK-ET-0002',
    professional_summary: 'Demo profile for validating the candidate introduction workflow.',
    skills: ['Meal preparation', 'Kitchen hygiene'],
    languages: ['Amharic', 'Oromo'],
    intro_video_url: '/demo-intros/illustrative-introduction.mp4',
    email: 'jane.smith@example.test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    payment_status: 'unpaid',
  },
];

// Add a fallback check to prevent accessing undefined values
if (SPECIFIC_SEED_CANDIDATES.length === 0) {
  console.warn('[seed][candidates] SPECIFIC_SEED_CANDIDATES is empty.');
}

// Ensure new candidates are seeded dynamically from the database or other sources

export const SEED_CANDIDATE_STAGES: CandidateStage[] = SPECIFIC_SEED_CANDIDATES.flatMap(candidate => {
  const stages = generateInitialStages(candidate);
  const setStageStatus = (slug: string, status: StageStatus) => {
    const stageId = getStageId(slug);
    const stage = stages.find(item => item.stage_id === stageId);
    if (stage) {
      stage.status = status;
      stage.updated_at = new Date().toISOString();
    }
  };

  if (candidate.tracking_code === 'TRK-ET-0001') {
    setStageStatus('registration', 'Passed');
    setStageStatus('training', 'In Progress');
  } else if (candidate.tracking_code === 'TRK-ET-0002') {
    setStageStatus('registration', 'Passed');
    setStageStatus('training', 'Passed');
    setStageStatus('medical', 'In Progress');
  }

  return stages;
});

export const SEED_DOCUMENTS: Document[] = [
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[0].id,
    stage_id: getStageId('medical'),
    file_name: 'aster_initial_medical.pdf',
    file_type: 'application/pdf',
    storage_key: 'docs/aster/initial_medical.pdf',
    uploaded_at: new Date().toISOString(),
    public_url: '/placeholder.svg',
  },
  {
    id: uuidv4(),
    candidate_id: SPECIFIC_SEED_CANDIDATES[1].id,
    stage_id: getStageId('medical'),
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

export const generateCandidateStages = (): CandidateStage[] => [...SEED_CANDIDATE_STAGES];

// Exported `SPECIFIC_SEED_CANDIDATES` as `SEED_CANDIDATES` to resolve the missing export error.
export { SPECIFIC_SEED_CANDIDATES as SEED_CANDIDATES };