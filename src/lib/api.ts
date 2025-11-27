import {
  Candidate,
  CandidateStage,
  ALL_STAGES,
  CandidateDetail,
  PublicTrackingData,
  MedicalResult,
  StageStatus,
  Document,
  CandidateSummary,
  DashboardSummary,
  PipelineDistribution,
  CandidateSortField,
  SortDirection,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { 
    getCandidates, 
    getCandidateStages, 
    getMedicalResults, 
    getDocuments, 
    getConfig, 
    saveCandidates, 
    saveCandidateStages, 
    saveMedicalResults, 
    saveDocuments, 
    saveConfig 
} from './data-store';
import { calculateProgress, calculateOverallStatus, isAdult } from './utils-data';
import { generateInitialStages, AppConfig } from './data-seed';

// Define the required input type for creation
type CandidateCreationData = Omit<Candidate, 'id' | 'created_at' | 'updated_at'>;

// Define the required input type for updates
type CandidateUpdateData = Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at'>>;

// Helper to find stage ID by slug
const getStageId = (slug: string) => ALL_STAGES.find(s => s.slug === slug)?.id;

// --- Mock Payment Status Store ---
// In a real app, this would be a database field. Here we use localStorage.
const LS_PAYMENT_STATUS = 'mock_payment_status';

interface PaymentStatus {
    candidateId: string;
    stageId: number;
    isPaid: boolean;
}

const getPaymentStatuses = (): PaymentStatus[] => JSON.parse(localStorage.getItem(LS_PAYMENT_STATUS) || '[]');
const savePaymentStatuses = (data: PaymentStatus[]) => localStorage.setItem(LS_PAYMENT_STATUS, JSON.stringify(data));

// Initialize mock payment status for existing seed data (e.g., Candidate 1 paid for Initial Medical)
if (getPaymentStatuses().length === 0) {
    const initialMedicalStageId = getStageId('initial_medical');
    const candidate1 = getCandidates().find(c => c.tracking_code === 'TRK-ET-0001');
    if (candidate1 && initialMedicalStageId) {
        savePaymentStatuses([{ candidateId: candidate1.id, stageId: initialMedicalStageId, isPaid: true }]);
    }
}
// --- End Mock Payment Status Store ---


export const api = {
  // NEW: Verify candidate credentials for login
  verifyCandidateCredentials: async (trackingCode: string, passportNumber: string): Promise<Candidate | null> => {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    
    const candidates = getCandidates();
    
    const code = trackingCode.toUpperCase();
    const passport = passportNumber.toUpperCase();
    
    // Find candidate matching EITHER tracking code OR passport number
    const candidate = candidates.find(c => 
        (code && c.tracking_code.toUpperCase() === code) || 
        (passport && c.passport_number.toUpperCase() === passport)
    );
    
    return candidate || null;
  },
  
  // NEW: Mock endpoint to update payment status
  updatePaymentStatus: async (candidateId: string, stageId: number, isPaid: boolean): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const statuses = getPaymentStatuses();
    const index = statuses.findIndex(s => s.candidateId === candidateId && s.stageId === stageId);

    if (index !== -1) {
        statuses[index].isPaid = isPaid;
    } else if (isPaid) {
        statuses.push({ candidateId, stageId, isPaid: true });
    }
    savePaymentStatuses(statuses);
  },
  
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
  searchCandidates: async (
    query: string, 
    filterStatus?: CandidateSummary['overall_status'], 
    filterBatch?: string,
    sortBy: CandidateSortField = 'tracking_code', // Default sort
    sortDirection: SortDirection = 'asc' // Default direction
  ): Promise<CandidateSummary[]> => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const q = query.toLowerCase();
    
    // 1. Augment candidates with calculated status/progress
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

    // 2. Filter candidates
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
    
    // 3. Sort candidates
    const sortedCandidates = filteredCandidates.sort((a, b) => {
        let comparison = 0;
        
        // Helper for string comparison
        const compareStrings = (valA: string | undefined, valB: string | undefined) => {
            const strA = (valA || '').toLowerCase();
            const strB = (valB || '').toLowerCase();
            if (strA < strB) comparison = -1;
            if (strA > strB) comparison = 1;
        };
        
        // Helper for numeric comparison
        const compareNumbers = (valA: number, valB: number) => {
            comparison = valA - valB;
        };
        
        switch (sortBy) {
            case 'progress_percent':
                compareNumbers(a.progress_percent, b.progress_percent);
                break;
            case 'overall_status':
                // Define a custom order for status
                const statusOrder: Record<CandidateSummary['overall_status'], number> = {
                    'Blocked': 1,
                    'In Progress': 2,
                    'Pending': 3,
                    'Completed': 4,
                };
                compareNumbers(statusOrder[a.overall_status], statusOrder[b.overall_status]);
                break;
            case 'marital_status':
                compareStrings(a.marital_status, b.marital_status);
                break;
            case 'country_of_origin':
                compareStrings(a.country_of_origin, b.country_of_origin);
                break;
            case 'tracking_code':
                compareStrings(a.tracking_code, b.tracking_code);
                break;
            case 'first_name':
            default:
                compareStrings(a.first_name + a.last_name, b.first_name + b.last_name);
                break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sortedCandidates;
  },

  // GET /api/admin/candidate/:id
  getCandidateDetail: async (candidateId: string): Promise<CandidateDetail | null> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.id === candidateId);
    if (!candidate) return null;

    const stages = getCandidateStages().filter(cs => cs.candidate_id === candidate.id);
    const medical_results = getMedicalResults().filter(mr => mr.candidate_id === candidate.id);
    const documents = getDocuments().filter(d => d.candidate_id === candidate.id);

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
    
    // --- Duplicate Check for Updates ---
    const newTrackingCode = data.tracking_code;
    const newPassportNumber = data.passport_number;
    
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
    // --- End Duplicate Check ---

    const updatedCandidate: Candidate = {
      ...existingCandidate,
      ...data,
      updated_at: new Date().toISOString(),
    } as Candidate; // Cast back to Candidate to satisfy return type

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
  
  // DELETE /api/admin/document/:id
  deleteDocument: async (documentId: string): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    let documents = getDocuments();
    const initialLength = documents.length;
    
    documents = documents.filter(doc => doc.id !== documentId);
    
    if (documents.length === initialLength) {
        throw new Error("Document not found.");
    }
    
    saveDocuments(documents);
    return { success: true };
  },
  
  // POST /api/admin/candidate
  createCandidate: async (data: CandidateCreationData): Promise<Candidate> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    
    // --- Duplicate Check for Creation ---
    if (candidates.some(c => c.tracking_code === data.tracking_code)) {
        throw new Error(`Tracking code '${data.tracking_code}' already exists.`);
    }
    if (candidates.some(c => c.passport_number === data.passport_number)) {
        throw new Error(`Passport number '${data.passport_number}' already exists.`);
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
  },

  // GET /api/track/:tracking_code
  getPublicTrackingData: async (trackingCode: string): Promise<PublicTrackingData | null> => {
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