import {
  Candidate,
  CandidateStage,
  ALL_STAGES,
  CandidateDetail,
  PublicTrackingData,
  MedicalResult,
  StageStatus,
  Document,
  TOTAL_STAGES,
  CandidateSummary,
  DashboardSummary,
  PipelineDistribution,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// --- Local Storage Keys ---
const LS_CANDIDATES = 'mock_candidates';
const LS_CANDIDATE_STAGES = 'mock_candidate_stages';
const LS_MEDICAL_RESULTS = 'mock_medical_results';
const LS_DOCUMENTS = 'mock_documents';
const LS_CONFIG = 'mock_config'; // New key

// --- Configuration Types ---
interface AppConfig {
    countryOptions: string[];
}

// --- Seed Data Constants ---
const MOCK_FIRST_NAMES = ['Aisha', 'Bruk', 'Chala', 'Desta', 'Elias', 'Fana', 'Girma', 'Hana', 'Ismail', 'Jemal', 'Kalkidan', 'Lelisa', 'Marta', 'Nardos', 'Oumer'];
const MOCK_LAST_NAMES = ['Ahmed', 'Kebede', 'Mekonnen', 'Tadesse', 'Wondimu', 'Zewde', 'Ali', 'Hassan', 'Mohamed'];
const MOCK_COUNTRIES = ['Ethiopia', 'Djibouti', 'Kenya', 'Somalia', 'Eritrea', 'Sudan', 'Yemen', 'Uganda'];
const TOTAL_NEW_CANDIDATES = 50;
const TOTAL_BATCHES = 13;

// Helper function to check if DOB is 18+
const isAdult = (dob: string): boolean => {
    const birthDate = new Date(dob);
    const ageDiffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) >= 18;
};

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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    first_name: 'Mariam',
    last_name: 'Tesfaye',
    dob: '2000-07-22', // Changed DOB to ensure 18+
    passport_number: 'EP9876543',
    tracking_code: 'TRK-ET-0002',
    country_of_origin: 'Ethiopia',
    batch_name: 'Batch 1',
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
        
        const trackingCode = `TRK-${countryCode}-${String(trackingCodeCounter++).padStart(4, '0')}`;
        
        // Generate a plausible DOB (18-35 years old)
        const currentYear = new Date().getFullYear();
        // Ensure age is 18+
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    }
    return newCandidates;
};

const NEW_MOCK_CANDIDATES = generateNewMockCandidates(4);
const SEED_CANDIDATES: Candidate[] = [...EXISTING_SEED_CANDIDATES, ...NEW_MOCK_CANDIDATES];

// Helper to find stage ID by slug
const getStageId = (slug: string) => ALL_STAGES.find(s => s.slug === slug)?.id;

// Helper to generate initial stages for a candidate
const generateInitialStages = (candidate: Candidate): CandidateStage[] => {
  const isAster = candidate.tracking_code === 'TRK-ET-0001';
  const isFatima = candidate.tracking_code === 'TRK-DJ-0003';
  
  // Determine random progress for new candidates
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
            // Random date in the last 60 days
            const daysAgo = Math.floor(Math.random() * 60);
            date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(); 
            
            if (stage.slug === 'labor_id' && status === 'Passed') {
                status = 'Issued';
                reference_id = `LID-${Math.floor(10000 + Math.random() * 90000)}`;
            }
            
            // Introduce a small chance of 'Failed' status for variety
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

const SEED_CANDIDATE_STAGES: CandidateStage[] = SEED_CANDIDATES.flatMap(candidate => generateInitialStages(candidate));

const SEED_DOCUMENTS: Document[] = [
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[0].id,
    stage_id: getStageId('initial_medical'),
    file_name: 'aster_initial_medical.pdf',
    file_type: 'application/pdf',
    storage_key: 'docs/aster/initial_medical.pdf',
    uploaded_at: new Date().toISOString(),
    public_url: '/placeholder.svg', // Mocked secure URL
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

const SEED_MEDICAL_RESULTS: MedicalResult[] = [
  // Aster Initial Medical
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[0].id,
    exam_type: 'HIV',
    status: 'Passed',
    exam_date: '2025-11-10',
    document_id: SEED_DOCUMENTS[0].id,
  },
  // Aster Final Medical (Fit)
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[0].id,
    exam_type: 'Final Agency Medical',
    status: 'Passed',
    exam_date: '2025-11-22',
  },
  // Mariam Initial Medical (Pending Pregnancy)
  {
    id: uuidv4(),
    candidate_id: EXISTING_SEED_CANDIDATES[1].id,
    exam_type: 'Pregnancy',
    status: 'Pending',
    exam_date: '2025-11-12',
    document_id: SEED_DOCUMENTS[1].id,
  },
];

const SEED_CONFIG: AppConfig = {
    countryOptions: ['Ethiopia', 'Djibouti', 'Somalia', 'Kenya', 'Eritrea', 'Sudan', 'Yemen', 'Uganda', 'Other'],
};

// --- Helper Functions ---

const getCandidates = (): Candidate[] => JSON.parse(localStorage.getItem(LS_CANDIDATES) || '[]');
const getCandidateStages = (): CandidateStage[] => JSON.parse(localStorage.getItem(LS_CANDIDATE_STAGES) || '[]');
const getMedicalResults = (): MedicalResult[] => JSON.parse(localStorage.getItem(LS_MEDICAL_RESULTS) || '[]');
const getDocuments = (): Document[] => JSON.parse(localStorage.getItem(LS_DOCUMENTS) || '[]');
const getConfig = (): AppConfig => JSON.parse(localStorage.getItem(LS_CONFIG) || JSON.stringify(SEED_CONFIG));

const saveCandidates = (data: Candidate[]) => localStorage.setItem(LS_CANDIDATES, JSON.stringify(data));
const saveCandidateStages = (data: CandidateStage[]) => localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(data));
const saveMedicalResults = (data: MedicalResult[]) => localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(data));
const saveDocuments = (data: Document[]) => localStorage.setItem(LS_DOCUMENTS, JSON.stringify(data));
const saveConfig = (data: AppConfig) => localStorage.setItem(LS_CONFIG, JSON.stringify(data));


// --- Data Store Initialization ---

function initializeDataStore() {
  // Only re-seed if candidates are missing, otherwise use existing local storage data
  if (getCandidates().length < 53) {
    localStorage.setItem(LS_CANDIDATES, JSON.stringify(SEED_CANDIDATES));
    localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(SEED_CANDIDATE_STAGES));
    localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(SEED_MEDICAL_RESULTS));
    localStorage.setItem(LS_DOCUMENTS, JSON.stringify(SEED_DOCUMENTS));
  }
  // Initialize config if not present
  if (!localStorage.getItem(LS_CONFIG)) {
      localStorage.setItem(LS_CONFIG, JSON.stringify(SEED_CONFIG));
  }
}

initializeDataStore();

// --- Progress Calculation Utility ---

export function calculateProgress(candidateStages: CandidateStage[]): number {
  if (candidateStages.length === 0) return 0;

  const completedStages = candidateStages.filter(
    (cs) => cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed'
  ).length;

  return Math.floor((completedStages / TOTAL_STAGES) * 100);
}

// --- Overall Status Calculation Utility ---

function calculateOverallStatus(candidateStages: CandidateStage[]): CandidateSummary['overall_status'] {
    const completedStages = candidateStages.filter(
        (cs) => cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed'
    );
    
    // Check for Blocked (any stage failed)
    const failedStage = candidateStages.find(cs => cs.status === 'Failed');
    if (failedStage) {
        return 'Blocked';
    }

    // Check for Completed (all stages passed/issued/completed)
    if (completedStages.length === TOTAL_STAGES) {
        return 'Completed';
    }
    
    // Check for In Progress (at least one stage passed/issued/completed, but not all)
    if (completedStages.length > 0) {
        return 'In Progress';
    }

    // Otherwise, Pending (no stages completed yet)
    return 'Pending';
}

// --- API Implementation ---

// Define the required input type for creation
type CandidateCreationData = Omit<Candidate, 'id' | 'created_at' | 'updated_at'>;

// Define the required input type for updates
type CandidateUpdateData = Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at'>>;

// Data structure for the pipeline distribution chart
export interface PipelineDistribution {
    stageTitle: string;
    ordinal: number;
    pendingCount: number;
    inProgressCount: number;
    blockedCount: number;
}

export const api = {
  // NEW: Get pipeline distribution data
  getPipelineDistribution: async (): Promise<PipelineDistribution[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    
    // Initialize distribution map for all stages
    const distributionMap = new Map<number, { pending: number, inProgress: number, blocked: number }>();
    ALL_STAGES.forEach(stage => {
        distributionMap.set(stage.id, { pending: 0, inProgress: 0, blocked: 0 });
    });
    
    // Determine the current blocking stage for each candidate
    candidates.forEach(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id).sort((a, b) => {
            const stageA = ALL_STAGES.find(s => s.id === a.stage_id)?.ordinal || 0;
            const stageB = ALL_STAGES.find(s => s.id === b.stage_id)?.ordinal || 0;
            return stageA - stageB;
        });
        
        let currentBlockingStageId: number | null = null;
        let isBlockedByFailure = false;
        
        for (const cs of candidateStages) {
            if (cs.status === 'Failed') {
                currentBlockingStageId = cs.stage_id;
                isBlockedByFailure = true;
                break;
            }
            if (cs.status === 'Pending' || cs.status === 'In Progress') {
                currentBlockingStageId = cs.stage_id;
                break;
            }
        }
        
        if (currentBlockingStageId) {
            const currentData = distributionMap.get(currentBlockingStageId)!;
            if (isBlockedByFailure) {
                currentData.blocked += 1;
            } else if (candidateStages.find(cs => cs.stage_id === currentBlockingStageId)?.status === 'In Progress') {
                currentData.inProgress += 1;
            } else {
                currentData.pending += 1;
            }
            distributionMap.set(currentBlockingStageId, currentData);
        }
        // Candidates who completed all stages are not counted here.
    });
    
    // Format output
    return ALL_STAGES.map(stage => {
        const data = distributionMap.get(stage.id)!;
        return {
            stageTitle: stage.title,
            ordinal: stage.ordinal,
            pendingCount: data.pending,
            inProgressCount: data.inProgress,
            blockedCount: data.blocked,
        };
    });
  },
  
  // NEW: Get configuration
  getAppConfig: async (): Promise<AppConfig> => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return getConfig();
  },
  
  // NEW: Update configuration
  updateAppConfig: async (config: AppConfig): Promise<AppConfig> => {
      await new Promise(resolve => setTimeout(resolve, 100));
      saveConfig(config);
      return config;
  },
  
  // GET /api/admin/batches
  getBatches: async (): Promise<string[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const flightDepartureStageId = getStageId('flight_departure');
    
    const batches = new Set<string>();
    
    candidates.forEach(candidate => {
        if (candidate.batch_name) {
            batches.add(candidate.batch_name);
        }
    });
    
    // Filter out batches where ALL candidates have completed the final stage
    const activeBatches = Array.from(batches).filter(batch => {
        const candidatesInBatch = candidates.filter(c => c.batch_name === batch);
        const allCompleted = candidatesInBatch.every(candidate => {
            const flightStage = allStages.find(
                cs => cs.candidate_id === candidate.id && cs.stage_id === flightDepartureStageId
            );
            return flightStage?.status === 'Completed';
        });
        return !allCompleted;
    }).sort(); // Sort alphabetically for consistency
    
    return activeBatches;
  },
  
  // GET /api/admin/summary
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    
    let pending = 0;
    let in_progress = 0;
    let completed = 0;
    let blocked = 0;
    
    candidates.forEach(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const status = calculateOverallStatus(candidateStages);
        
        if (status === 'Pending') pending++;
        else if (status === 'In Progress') in_progress++;
        else if (status === 'Completed') completed++;
        else if (status === 'Blocked') blocked++;
    });
    
    return {
        total: candidates.length,
        pending,
        in_progress,
        completed,
        blocked,
    };
  },
  
  // GET /api/admin/search?q=
  searchCandidates: async (query: string, filterStatus?: CandidateSummary['overall_status'], filterBatch?: string): Promise<CandidateSummary[]> => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const q = query.toLowerCase();

    const candidatesWithStatus = candidates.map(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const progress_percent = calculateProgress(candidateStages);
        const overall_status = calculateOverallStatus(candidateStages);
        return {
            ...candidate,
            progress_percent,
            overall_status,
        };
    });

    const filteredCandidates = candidatesWithStatus.filter(c => {
      const matchesQuery = 
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.passport_number.toLowerCase().includes(q) ||
        c.tracking_code.toLowerCase().includes(q);
        
      const matchesStatus = !filterStatus || c.overall_status === filterStatus;
      
      const matchesBatch = !filterBatch || c.batch_name === filterBatch;
      
      return matchesQuery && matchesStatus && matchesBatch;
    });
    
    return filteredCandidates;
  },

  // GET /api/admin/candidate/:id
  getCandidateDetail: async (candidateId: string): Promise<CandidateDetail | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.id === candidateId);
    if (!candidate) return null;

    const stages = getCandidateStages().filter(cs => cs.candidate_id === candidateId);
    const medical_results = getMedicalResults().filter(mr => mr.candidate_id === candidateId);
    const documents = getDocuments().filter(d => d.candidate_id === candidateId);

    return {
      ...candidate,
      stages: stages.sort((a, b) => {
        const stageA = ALL_STAGES.find(s => s.id === a.stage_id)?.ordinal || 0;
        const stageB = ALL_STAGES.find(s => s.id === b.stage_id)?.ordinal || 0;
        return stageA - stageB;
      }),
      medical_results,
      documents,
    };
  },
  
  // PATCH /api/admin/candidate/:id/details
  updateCandidateDetails: async (candidateId: string, data: CandidateUpdateData): Promise<Candidate> => {
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
    
    // Ensure tracking code uniqueness if updated
    if (data.tracking_code && data.tracking_code !== existingCandidate.tracking_code) {
        if (candidates.some(c => c.tracking_code === data.tracking_code)) {
            throw new Error("Tracking code already exists.");
        }
    }

    const updatedCandidate: Candidate = {
      ...existingCandidate,
      ...data,
      updated_at: new Date().toISOString(),
    };

    candidates[index] = updatedCandidate;
    saveCandidates(candidates);
    return updatedCandidate;
  },

  // PATCH /api/admin/candidate/:id/status
  updateStageStatus: async (
    candidateId: string,
    stageId: number,
    status: StageStatus,
    notes?: string,
    date?: string,
    referenceId?: string // Added new parameter
  ): Promise<CandidateStage> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allStages = getCandidateStages();
    const candidateStageIndex = allStages.findIndex(
      cs => cs.candidate_id === candidateId && cs.stage_id === stageId
    );

    if (candidateStageIndex === -1) {
      throw new Error('Stage not found for candidate.');
    }

    const stageSlug = ALL_STAGES.find(s => s.id === stageId)?.slug;

    // --- Compliance Rule 1 & 2: Final Medical Clearance Check for Flight Booking ---
    if (stageSlug === 'flight_departure' && (status === 'In Progress' || status === 'Completed')) {
      const finalMedicalStage = allStages.find(
        cs => cs.candidate_id === candidateId && ALL_STAGES.find(s => s.id === cs.stage_id)?.slug === 'final_medical'
      );
      
      if (finalMedicalStage?.status !== 'Passed') {
        throw new Error('Departure Blocked: Final Medical Clearance must be Passed (Fit).');
      }
      
      const medicalResults = getMedicalResults().filter(mr => mr.candidate_id === candidateId);
      
      // Check for pregnancy test failure (Unfit status)
      const pregnancyTestFailed = medicalResults.some(mr => mr.exam_type === 'Pregnancy' && mr.status === 'Failed');
      
      if (pregnancyTestFailed) {
         throw new Error('Departure Blocked: Pregnancy test result prevents flight booking (Unfit).');
      }
    }

    const updatedStage = {
      ...allStages[candidateStageIndex],
      status,
      notes: notes ?? allStages[candidateStageIndex].notes,
      date: date ?? (status !== 'Pending' ? new Date().toISOString() : undefined),
      reference_id: referenceId ?? allStages[candidateStageIndex].reference_id, // Save new field
      updated_at: new Date().toISOString(),
    };

    allStages[candidateStageIndex] = updatedStage;
    saveCandidateStages(allStages);
    return updatedStage;
  },

  // POST /api/admin/candidate/:id/upload
  uploadDocument: async (
    candidateId: string,
    stageId: number,
    file: File
  ): Promise<Document> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const documents = getDocuments();
    const candidate = getCandidates().find(c => c.id === candidateId);
    
    if (!candidate) throw new Error("Candidate not found.");

    const newDoc: Document = {
      id: uuidv4(),
      candidate_id: candidateId,
      stage_id: stageId,
      file_name: file.name,
      file_type: file.type,
      storage_key: `docs/${candidate.tracking_code}/${file.name}`,
      uploaded_at: new Date().toISOString(),
      public_url: '/placeholder.svg',
    };

    documents.push(newDoc);
    saveDocuments(documents);
    return newDoc;
  },
  
  // POST /api/admin/candidate
  createCandidate: async (data: CandidateCreationData): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    
    if (candidates.some(c => c.tracking_code === data.tracking_code)) {
        throw new Error("Tracking code already exists.");
    }
    
    // Age validation
    if (!isAdult(data.dob)) {
        throw new Error("Candidate must be 18 years or older.");
    }

    const newCandidate: Candidate = {
        ...data,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    
    candidates.push(newCandidate);
    saveCandidates(candidates);
    
    // Initialize stages for the new candidate
    const initialStages = generateInitialStages(newCandidate);
    const allStages = getCandidateStages();
    saveCandidateStages([...allStages, ...initialStages]);

    return newCandidate;
  },

  // GET /api/track/:tracking_code
  getPublicTrackingData: async (trackingCode: string): Promise<PublicTrackingData | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.tracking_code === trackingCode);
    if (!candidate) return null;

    const stages = getCandidateStages().filter(cs => cs.candidate_id === candidate.id);
    const medicalResults = getMedicalResults().filter(mr => mr.candidate_id === candidate.id);
    const documents = getDocuments().filter(d => d.candidate_id === candidate.id);

    const progress_percent = calculateProgress(stages);

    const timeline = stages
      .map(cs => {
        const stage = ALL_STAGES.find(s => s.id === cs.stage_id)!;
        const stageDocs = documents.filter(d => d.stage_id === stage.id);
        
        let medical_status_summary: StageStatus | undefined = undefined;
        const is_medical_stage = stage.slug === 'initial_medical' || stage.slug === 'final_medical';

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
  },
  
  // Placeholder for SMS/WhatsApp hook
  sendNotification: async (type: 'sms' | 'whatsapp', recipient: string, message: string) => {
      console.log(`[MOCK NOTIFICATION] Sending ${type} to ${recipient}: ${message}`);
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true };
  },
  
  // Placeholder for Printable Progress Sheet
  generatePrintableSheet: async (trackingCode: string) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const candidate = getCandidates().find(c => c.tracking_code === trackingCode);
      if (!candidate) throw new Error("Candidate not found.");
      
      // We need the full detail to generate the sheet, so we fetch it using the ID
      const detail = await api.getCandidateDetail(candidate.id);
      if (!detail) throw new Error("Candidate detail not found.");
      
      // In a real app, this would generate a PDF/HTML view. Here we return the data.
      console.log(`[MOCK EXPORT] Generating printable sheet for ${detail.tracking_code}`);
      return detail;
  },
  
  // Admin: Update Medical Result (needed for compliance testing)
  updateMedicalResult: async (
    candidateId: string,
    examType: string,
    status: 'Passed' | 'Failed' | 'Pending',
    examDate?: string
  ): Promise<MedicalResult> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allResults = getMedicalResults();
    let result = allResults.find(r => r.candidate_id === candidateId && r.exam_type === examType);

    if (result) {
        result.status = status;
        result.exam_date = examDate || result.exam_date;
        result.notes = result.notes;
    } else {
        result = {
            id: uuidv4(),
            candidate_id: candidateId,
            exam_type: examType,
            status: status,
            exam_date: examDate,
            notes: undefined,
            document_id: undefined,
        };
        allResults.push(result);
    }
    
    saveMedicalResults(allResults);
    return result;
  }
};