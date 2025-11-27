import { Candidate, CandidateStage, MedicalResult, Document, StaffUser } from './types';
import { LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_MEDICAL_RESULTS, LS_DOCUMENTS, LS_CONFIG, LS_STAFF_USERS } from './data-keys';
import { SEED_CANDIDATES, SEED_CANDIDATE_STAGES, SEED_MEDICAL_RESULTS, SEED_DOCUMENTS, SEED_CONFIG, AppConfig, SEED_STAFF_USERS } from './data-seed';

// --- Getter Functions ---

export const getCandidates = (): Candidate[] => JSON.parse(localStorage.getItem(LS_CANDIDATES) || '[]');
export const getCandidateStages = (): CandidateStage[] => JSON.parse(localStorage.getItem(LS_CANDIDATE_STAGES) || '[]');
export const getMedicalResults = (): MedicalResult[] => JSON.parse(localStorage.getItem(LS_MEDICAL_RESULTS) || '[]');
export const getDocuments = (): Document[] => JSON.parse(localStorage.getItem(LS_DOCUMENTS) || '[]');
export const getConfig = (): AppConfig => JSON.parse(localStorage.getItem(LS_CONFIG) || JSON.stringify(SEED_CONFIG));
export const getStaffUsers = (): StaffUser[] => JSON.parse(localStorage.getItem(LS_STAFF_USERS) || '[]');

// --- Setter Functions ---

export const saveCandidates = (data: Candidate[]) => localStorage.setItem(LS_CANDIDATES, JSON.stringify(data));
export const saveCandidateStages = (data: CandidateStage[]) => localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(data));
export const saveMedicalResults = (data: MedicalResult[]) => localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(data));
export const saveDocuments = (data: Document[]) => localStorage.setItem(LS_DOCUMENTS, JSON.stringify(data));
export const saveConfig = (data: AppConfig) => localStorage.setItem(LS_CONFIG, JSON.stringify(data));
export const saveStaffUsers = (data: StaffUser[]) => localStorage.setItem(LS_STAFF_USERS, JSON.stringify(data));

// --- Initialization ---

export function initializeDataStore() {
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
  // Initialize staff users if not present
  if (getStaffUsers().length === 0) {
      localStorage.setItem(LS_STAFF_USERS, JSON.stringify(SEED_STAFF_USERS));
  }
}

// Run initialization immediately
initializeDataStore();