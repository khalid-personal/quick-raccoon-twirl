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
} from './types';
import { v4 as uuidv4 } from 'uuid';

// --- Local Storage Keys ---
const LS_CANDIDATES = 'mock_candidates';
const LS_CANDIDATE_STAGES = 'mock_candidate_stages';
const LS_MEDICAL_RESULTS = 'mock_medical_results';
const LS_DOCUMENTS = 'mock_documents';

// --- Seed Data (Based on provided SQL/JSON) ---

const SEED_CANDIDATES: Candidate[] = [
  {
    id: uuidv4(),
    first_name: 'Aster',
    last_name: 'Bekele',
    dob: '1997-05-14',
    passport_number: 'EP1234567',
    tracking_code: 'TRK-ET-0001',
    country_of_origin: 'Ethiopia',
    is_minor: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    first_name: 'Mariam',
    last_name: 'Tesfaye',
    dob: '2006-07-22',
    passport_number: 'EP9876543',
    tracking_code: 'TRK-ET-0002',
    country_of_origin: 'Ethiopia',
    is_minor: true,
    guardian_name: 'Kumera Tesfaye',
    guardian_contact: '+251911000111',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Helper to generate initial stages for a candidate
const generateInitialStages = (candidateId: string): CandidateStage[] => {
  return ALL_STAGES.map((stage) => {
    const now = new Date().toISOString();
    let status: StageStatus = 'Pending';
    let date: string | undefined = undefined;

    // Apply specific seed statuses for TRK-ET-0001 (Aster)
    if (candidateId === SEED_CANDIDATES[0].id) {
      if (stage.slug === 'initial_medical') {
        status = 'Passed';
        date = '2025-11-10T00:00:00Z';
      } else if (stage.slug === 'labor_id') {
        status = 'Issued';
        date = '2025-11-20T00:00:00Z';
      } else if (stage.slug === 'final_medical') {
        status = 'Passed';
        date = '2025-11-22T00:00:00Z';
      }
    }

    return {
      id: uuidv4(),
      candidate_id: candidateId,
      stage_id: stage.id,
      status: status,
      notes: undefined,
      date: date,
      updated_at: now,
    };
  });
};

const SEED_CANDIDATE_STAGES: CandidateStage[] = [
  ...generateInitialStages(SEED_CANDIDATES[0].id),
  ...generateInitialStages(SEED_CANDIDATES[1].id),
];

// Helper to find stage ID by slug
const getStageId = (slug: string) => ALL_STAGES.find(s => s.slug === slug)?.id;

const SEED_DOCUMENTS: Document[] = [
  {
    id: uuidv4(),
    candidate_id: SEED_CANDIDATES[0].id,
    stage_id: getStageId('initial_medical'),
    file_name: 'aster_initial_medical.pdf',
    file_type: 'application/pdf',
    storage_key: 'docs/aster/initial_medical.pdf',
    uploaded_at: new Date().toISOString(),
    public_url: '/placeholder.svg', // Mocked secure URL
  },
  {
    id: uuidv4(),
    candidate_id: SEED_CANDIDATES[1].id,
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
    candidate_id: SEED_CANDIDATES[0].id,
    exam_type: 'HIV',
    status: 'Passed',
    exam_date: '2025-11-10',
    document_id: SEED_DOCUMENTS[0].id,
  },
  // Aster Final Medical (Fit)
  {
    id: uuidv4(),
    candidate_id: SEED_CANDIDATES[0].id,
    exam_type: 'Final Agency Medical',
    status: 'Passed',
    exam_date: '2025-11-22',
  },
  // Mariam Initial Medical (Pending Pregnancy)
  {
    id: uuidv4(),
    candidate_id: SEED_CANDIDATES[1].id,
    exam_type: 'Pregnancy',
    status: 'Pending',
    exam_date: '2025-11-12',
    document_id: SEED_DOCUMENTS[1].id,
  },
];

// --- Data Store Initialization ---

function initializeDataStore() {
  if (!localStorage.getItem(LS_CANDIDATES)) {
    localStorage.setItem(LS_CANDIDATES, JSON.stringify(SEED_CANDIDATES));
    localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(SEED_CANDIDATE_STAGES));
    localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(SEED_MEDICAL_RESULTS));
    localStorage.setItem(LS_DOCUMENTS, JSON.stringify(SEED_DOCUMENTS));
  }
}

initializeDataStore();

// --- Helper Functions ---

const getCandidates = (): Candidate[] => JSON.parse(localStorage.getItem(LS_CANDIDATES) || '[]');
const getCandidateStages = (): CandidateStage[] => JSON.parse(localStorage.getItem(LS_CANDIDATE_STAGES) || '[]');
const getMedicalResults = (): MedicalResult[] => JSON.parse(localStorage.getItem(LS_MEDICAL_RESULTS) || '[]');
const getDocuments = (): Document[] => JSON.parse(localStorage.getItem(LS_DOCUMENTS) || '[]');

const saveCandidates = (data: Candidate[]) => localStorage.setItem(LS_CANDIDATES, JSON.stringify(data));
const saveCandidateStages = (data: CandidateStage[]) => localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(data));
const saveMedicalResults = (data: MedicalResult[]) => localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(data));
const saveDocuments = (data: Document[]) => localStorage.setItem(LS_DOCUMENTS, JSON.stringify(data));

// --- Progress Calculation Utility ---

export function calculateProgress(candidateStages: CandidateStage[]): number {
  if (candidateStages.length === 0) return 0;

  const completedStages = candidateStages.filter(
    (cs) => cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed'
  ).length;

  return Math.floor((completedStages / TOTAL_STAGES) * 100);
}

// --- API Implementation ---

export const api = {
  // GET /api/admin/search?q=
  searchCandidates: async (query: string): Promise<CandidateSummary[]> => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const q = query.toLowerCase();

    const filteredCandidates = candidates.filter(c =>
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.passport_number?.toLowerCase().includes(q) ||
      c.tracking_code.toLowerCase().includes(q)
    );
    
    // Calculate progress for each filtered candidate
    return filteredCandidates.map(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const progress_percent = calculateProgress(candidateStages);
        return {
            ...candidate,
            progress_percent,
        };
    });
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

  // PATCH /api/admin/candidate/:id/status
  updateStageStatus: async (
    candidateId: string,
    stageId: number,
    status: StageStatus,
    notes?: string,
    date?: string
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
  createCandidate: async (data: Omit<Candidate, 'id' | 'created_at' | 'updated_at' | 'is_minor'> & { dob?: string }): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    
    if (candidates.some(c => c.tracking_code === data.tracking_code)) {
        throw new Error("Tracking code already exists.");
    }
    
    const isMinor = data.dob ? (new Date().getFullYear() - new Date(data.dob).getFullYear() < 18) : false;

    const newCandidate: Candidate = {
        ...data,
        id: uuidv4(),
        is_minor: isMinor,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    } as Candidate; // Cast to Candidate to satisfy type requirements after calculating is_minor
    
    candidates.push(newCandidate);
    saveCandidates(candidates);
    
    // Initialize stages for the new candidate
    const initialStages = generateInitialStages(newCandidate.id);
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
  generatePrintableSheet: async (candidateId: string) => {
      const detail = await api.getCandidateDetail(candidateId);
      if (!detail) throw new Error("Candidate not found.");
      
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