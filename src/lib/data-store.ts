import { Candidate, CandidateStage, MedicalResult, Document, StaffUser, ChatMessage, ApprovalLog, AttendanceRecord, AuthorizationCode, CocFacility, LocalAgency, ForeignAgency } from './types';
import { LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_MEDICAL_RESULTS, LS_DOCUMENTS, LS_CONFIG, LS_STAFF_USERS, LS_PAYMENT_STATUS, LS_CHAT_MESSAGES, LS_APPROVAL_LOGS, LS_ATTENDANCE, LS_AUTH_CODES, LS_COC_FACILITIES, LS_LOCAL_AGENCIES, LS_FOREIGN_AGENCIES } from './data-keys';
import { SEED_CANDIDATES, SEED_CANDIDATE_STAGES, SEED_MEDICAL_RESULTS, SEED_DOCUMENTS, SEED_CONFIG, AppConfig, SEED_STAFF_USERS, SEED_CHAT_MESSAGES, SEED_APPROVAL_LOGS, SEED_ATTENDANCE, SEED_AUTH_CODES, SEED_COC_FACILITIES, SEED_LOCAL_AGENCIES, SEED_FOREIGN_AGENCIES } from './data-seed';

// Define PaymentStatus interface locally for data store usage
interface PaymentStatus {
    candidateId: string;
    stageId: number;
    isPaid: boolean;
}

// --- Getter Functions ---

export const getCandidates = (): Candidate[] => JSON.parse(localStorage.getItem(LS_CANDIDATES) || '[]');
export const getCandidateStages = (): CandidateStage[] => JSON.parse(localStorage.getItem(LS_CANDIDATE_STAGES) || '[]');
export const getMedicalResults = (): MedicalResult[] => JSON.parse(localStorage.getItem(LS_MEDICAL_RESULTS) || '[]');
export const getDocuments = (): Document[] => JSON.parse(localStorage.getItem(LS_DOCUMENTS) || '[]');
export const getConfig = (): AppConfig => JSON.parse(localStorage.getItem(LS_CONFIG) || JSON.stringify(SEED_CONFIG));
export const getStaffUsers = (): StaffUser[] => JSON.parse(localStorage.getItem(LS_STAFF_USERS) || '[]');
export const getPaymentStatuses = (): PaymentStatus[] => JSON.parse(localStorage.getItem(LS_PAYMENT_STATUS) || '[]');
export const getChatMessages = (): ChatMessage[] => JSON.parse(localStorage.getItem(LS_CHAT_MESSAGES) || '[]');
export const getApprovalLogs = (): ApprovalLog[] => JSON.parse(localStorage.getItem(LS_APPROVAL_LOGS) || '[]');
export const getAttendanceRecords = (): AttendanceRecord[] => JSON.parse(localStorage.getItem(LS_ATTENDANCE) || '[]');
export const getAuthorizationCodes = (): AuthorizationCode[] => JSON.parse(localStorage.getItem(LS_AUTH_CODES) || '[]');
export const getCocFacilities = (): CocFacility[] => JSON.parse(localStorage.getItem(LS_COC_FACILITIES) || '[]'); // NEW
export const getLocalAgencies = (): LocalAgency[] => JSON.parse(localStorage.getItem(LS_LOCAL_AGENCIES) || '[]'); // NEW
export const getForeignAgencies = (): ForeignAgency[] => JSON.parse(localStorage.getItem(LS_FOREIGN_AGENCIES) || '[]'); // NEW

// --- Setter Functions ---

export const saveCandidates = (data: Candidate[]) => localStorage.setItem(LS_CANDIDATES, JSON.stringify(data));
export const saveCandidateStages = (data: CandidateStage[]) => localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(data));
export const saveMedicalResults = (data: MedicalResult[]) => localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(data));
export const saveDocuments = (data: Document[]) => localStorage.setItem(LS_DOCUMENTS, JSON.stringify(data));
export const saveConfig = (data: AppConfig) => localStorage.setItem(LS_CONFIG, JSON.stringify(data));
export const saveStaffUsers = (data: StaffUser[]) => localStorage.setItem(LS_STAFF_USERS, JSON.stringify(data));
export const savePaymentStatuses = (data: PaymentStatus[]) => localStorage.setItem(LS_PAYMENT_STATUS, JSON.stringify(data));
export const saveChatMessages = (data: ChatMessage[]) => localStorage.setItem(LS_CHAT_MESSAGES, JSON.stringify(data));
export const saveApprovalLogs = (data: ApprovalLog[]) => localStorage.setItem(LS_APPROVAL_LOGS, JSON.stringify(data));
export const saveAttendanceRecords = (data: AttendanceRecord[]) => localStorage.setItem(LS_ATTENDANCE, JSON.stringify(data));
export const saveAuthorizationCodes = (data: AuthorizationCode[]) => localStorage.setItem(LS_AUTH_CODES, JSON.stringify(data));
export const saveCocFacilities = (data: CocFacility[]) => localStorage.setItem(LS_COC_FACILITIES, JSON.stringify(data)); // NEW
export const saveLocalAgencies = (data: LocalAgency[]) => localStorage.setItem(LS_LOCAL_AGENCIES, JSON.stringify(data)); // NEW
export const saveForeignAgencies = (data: ForeignAgency[]) => localStorage.setItem(LS_FOREIGN_AGENCIES, JSON.stringify(data)); // NEW

// --- Initialization ---

export function initializeDataStore() {
  // To force re-seed for this change, we'll clear all relevant local storage keys
  localStorage.removeItem(LS_CANDIDATES);
  localStorage.removeItem(LS_CANDIDATE_STAGES);
  localStorage.removeItem(LS_MEDICAL_RESULTS);
  localStorage.removeItem(LS_DOCUMENTS);
  localStorage.removeItem(LS_CHAT_MESSAGES);
  localStorage.removeItem(LS_APPROVAL_LOGS);
  localStorage.removeItem(LS_ATTENDANCE);
  localStorage.removeItem(LS_AUTH_CODES);
  localStorage.removeItem(LS_PAYMENT_STATUS);
  localStorage.removeItem(LS_STAFF_USERS);
  localStorage.removeItem(LS_CONFIG); 
  localStorage.removeItem(LS_COC_FACILITIES); // NEW
  localStorage.removeItem(LS_LOCAL_AGENCIES); // NEW
  localStorage.removeItem(LS_FOREIGN_AGENCIES); // NEW

  localStorage.setItem(LS_CANDIDATES, JSON.stringify(SEED_CANDIDATES));
  localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(SEED_CANDIDATE_STAGES));
  localStorage.setItem(LS_MEDICAL_RESULTS, JSON.stringify(SEED_MEDICAL_RESULTS));
  localStorage.setItem(LS_DOCUMENTS, JSON.stringify(SEED_DOCUMENTS));
  localStorage.setItem(LS_CHAT_MESSAGES, JSON.stringify(SEED_CHAT_MESSAGES));
  localStorage.setItem(LS_APPROVAL_LOGS, JSON.stringify(SEED_APPROVAL_LOGS));
  localStorage.setItem(LS_ATTENDANCE, JSON.stringify(SEED_ATTENDANCE));
  localStorage.setItem(LS_AUTH_CODES, JSON.stringify(SEED_AUTH_CODES));
  localStorage.setItem(LS_STAFF_USERS, JSON.stringify(SEED_STAFF_USERS));
  localStorage.setItem(LS_COC_FACILITIES, JSON.stringify(SEED_COC_FACILITIES)); // NEW
  localStorage.setItem(LS_LOCAL_AGENCIES, JSON.stringify(SEED_LOCAL_AGENCIES)); // NEW
  localStorage.setItem(LS_FOREIGN_AGENCIES, JSON.stringify(SEED_FOREIGN_AGENCIES)); // NEW

  // Initialize config with new fields
  const currentConfig = getConfig(); // This will now return SEED_CONFIG if cleared
  saveConfig({ 
      ...currentConfig, 
      countryOptions: currentConfig.countryOptions || SEED_CONFIG.countryOptions,
      cocFacilities: currentConfig.cocFacilities || SEED_CONFIG.cocFacilities, // NEW
      foreignAgencies: currentConfig.foreignAgencies || SEED_CONFIG.foreignAgencies,
      localAgencies: currentConfig.localAgencies || SEED_CONFIG.localAgencies, // NEW
  });
}

// Run initialization immediately
initializeDataStore();