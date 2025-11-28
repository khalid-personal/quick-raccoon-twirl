import * as CandidateCrud from './candidate-crud';
import * as StageManagement from './stage-management';
import * as DocumentManagement from './document-management';
import * as DashboardQueries from './dashboard-queries';
import * as ConfigManagement from './config-management';
import * as UserManagement from './user-management';
import * as MedicalManagement from './medical-management';
import * as PaymentManagement from './payment-management'; // This is the old one, will be replaced
import * as TrackingQueries from './tracking-queries';
import * as ChatManagement from './chat-management';
import * as LogManagement from './log-management';
import * as AttendanceManagement from './attendance-management';
import * as AuthorizationCodeManagement from './authorization-codes';
import * as PaymentProcessing from './payment-processing'; // NEW IMPORT

// Combine all modules into a single API object
export const api = {
    ...CandidateCrud,
    ...StageManagement,
    ...DocumentManagement,
    ...DashboardQueries,
    ...ConfigManagement,
    ...UserManagement,
    ...MedicalManagement,
    ...PaymentManagement, // Keep the old one for now if it has other functions, or remove if fully replaced
    ...TrackingQueries,
    ...ChatManagement,
    ...LogManagement,
    ...AttendanceManagement,
    ...AuthorizationCodeManagement,
    ...PaymentProcessing, // NEW
};