import { Candidate, CandidateStage, MedicalResult, Document, ALL_STAGES, StageStatus, StaffUser, ChatMessage, ApprovalLog, AttendanceRecord, AuthorizationCode, AppConfig, Payment } from './types'; // AppConfig is now imported from types

// Import individual seed data modules
import { SEED_COC_FACILITIES } from './seed/coc-facilities';
import { SEED_LOCAL_AGENCIES } from './seed/local-agencies';
import { SEED_FOREIGN_AGENCIES } from './seed/foreign-agencies';
import { SEED_CONFIG } from './seed/config';
import { MOCK_ADMIN_EMAIL, MOCK_STAFF_EMAIL, MOCK_STAFF_ID, SEED_STAFF_USERS } from './seed/staff-users';
import { generateInitialStages, SEED_CANDIDATES, SEED_CANDIDATE_STAGES, SEED_DOCUMENTS, SEED_MEDICAL_RESULTS } from './seed/candidates';
import { SEED_CHAT_MESSAGES } from './seed/chat-messages';
import { SEED_APPROVAL_LOGS } from './seed/approval-logs';
import { SEED_ATTENDANCE } from './seed/attendance';
import { SEED_AUTH_CODES } from './seed/auth-codes';
import { SEED_PAYMENTS } from './seed/payments'; // NEW IMPORT

// Re-export all seed data and helper functions
export {
    AppConfig, // Re-export AppConfig type
    SEED_COC_FACILITIES,
    SEED_LOCAL_AGENCIES,
    SEED_FOREIGN_AGENCIES,
    SEED_CONFIG,
    MOCK_ADMIN_EMAIL,
    MOCK_STAFF_EMAIL,
    MOCK_STAFF_ID,
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
};