import * as CandidateCrud from './candidate-crud';
import * as StageManagement from './stage-management';
import * as DocumentManagement from './document-management';
import * as DashboardQueries from './dashboard-queries';
import * as ExecutiveMetrics from './executive-metrics';
import * as ConfigManagement from './config-management';
import * as UserManagement from './user-management';
import * as MedicalManagement from './medical-management';
// Note: Old payment-management module removed; using payment-processing.ts for payments
import * as TrackingQueries from './tracking-queries';
import * as ChatManagement from './chat-management';
import * as AgencyChat from './agency-chat';
import * as LogManagement from './log-management';
import * as AttendanceManagement from './attendance-management';
import * as AuthorizationCodeManagement from './authorization-codes';
import * as PaymentProcessing from './payment-processing'; // NEW IMPORT
import * as UserProfile from './user-profile'; // NEW IMPORT
import * as NotificationsApi from './notifications';

// Combine all modules into a single API object
export const api = {
    ...CandidateCrud,
    ...StageManagement,
    ...DocumentManagement,
    ...DashboardQueries,
    ...ExecutiveMetrics,
    ...ConfigManagement,
    ...UserManagement,
    ...MedicalManagement,
    ...TrackingQueries,
    ...ChatManagement,
    ...AgencyChat,
    ...LogManagement,
    ...AttendanceManagement,
    ...AuthorizationCodeManagement,
    ...PaymentProcessing,
    ...UserProfile,
    ...NotificationsApi,
};
export default api;