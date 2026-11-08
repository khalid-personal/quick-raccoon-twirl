import { Candidate, CandidateStage, MedicalResult, Document, ALL_STAGES, StageStatus, StaffUser, ChatMessage, ApprovalLog, AttendanceRecord, AuthorizationCode, Payment } from './types'; // AppConfig is a type-only export

// Import individual seed data modules
import { SEED_COC_FACILITIES } from './seed/coc-facilities';
import { SEED_LOCAL_AGENCIES } from './seed/local-agencies';
import { SEED_FOREIGN_AGENCIES } from './seed/foreign-agencies';
import { SEED_CONFIG } from './seed/config';
import { PLACEHOLDER_ADMIN_EMAIL, PLACEHOLDER_STAFF_EMAIL, PLACEHOLDER_STAFF_ID, SEED_STAFF_USERS } from './seed/staff-users';
import { generateInitialStages, SEED_CANDIDATES, SEED_CANDIDATE_STAGES, SEED_DOCUMENTS, SEED_MEDICAL_RESULTS } from './seed/candidates';
import { SEED_CHAT_MESSAGES } from './seed/chat-messages';
import { SEED_APPROVAL_LOGS } from './seed/approval-logs';
import { SEED_ATTENDANCE } from './seed/attendance';
import { SEED_AUTH_CODES } from './seed/auth-codes';
import { SEED_PAYMENTS } from './seed/payments'; // NEW IMPORT
import { SEED_AGENCY_THREADS } from './seed/agency-threads';
import { SEED_AGENCY_MESSAGES } from './seed/agency-messages';

// Re-export all seed data and helper functions
export type { AppConfig } from './types';
export {
    SEED_COC_FACILITIES,
    SEED_LOCAL_AGENCIES,
    SEED_FOREIGN_AGENCIES,
    SEED_CONFIG,
    PLACEHOLDER_ADMIN_EMAIL,
    PLACEHOLDER_STAFF_EMAIL,
    PLACEHOLDER_STAFF_ID,
    SEED_STAFF_USERS,
    generateInitialStages,
    SEED_CANDIDATES,
    SEED_CANDIDATE_STAGES,
    SEED_DOCUMENTS,
    SEED_MEDICAL_RESULTS,
    SEED_CHAT_MESSAGES,
    SEED_APPROVAL_LOGS,
    SEED_ATTENDANCE,
    SEED_AUTH_CODES,
    SEED_PAYMENTS, // NEW EXPORT
    SEED_AGENCY_THREADS,
    SEED_AGENCY_MESSAGES,
};