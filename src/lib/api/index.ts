import * as CandidateCrud from './candidate-crud';
import * as StageManagement from './stage-management';
import * as DocumentManagement from './document-management';
import * as DashboardQueries from './dashboard-queries';
import * as ConfigManagement from './config-management';
import * as UserManagement from './user-management';
import * as MedicalManagement from './medical-management';
import * as PaymentManagement from './payment-management';
import * as TrackingQueries from './tracking-queries';
import * as ChatManagement from './chat-management';
import * as LogManagement from './log-management'; // NEW IMPORT

// Combine all modules into a single API object
export const api = {
    ...CandidateCrud,
    ...StageManagement,
    ...DocumentManagement,
    ...DashboardQueries,
    ...ConfigManagement,
    ...UserManagement,
    ...MedicalManagement,
    ...PaymentManagement,
    ...TrackingQueries,
    ...ChatManagement,
    ...LogManagement, // NEW
};