import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '@/lib/types';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LayoutEditProvider } from '@/lib/layout-edit';
import AdminLayout from '@/components/AdminLayout';
import LocalAgencyLayout from '@/components/LocalAgencyLayout';
import AgencyLayout from '@/components/AgencyLayout';
import AuditorLayout from '@/components/AuditorLayout';
import { CandidateQuickViewProvider } from '@/components/CandidateQuickViewProvider';
import PortalWalkthrough from '@/components/PortalWalkthrough';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminCandidateDetail from '@/pages/AdminCandidateDetail';
import AdminUserManagement from '@/pages/AdminUserManagement';
import AgencyUserManagement from '@/pages/AgencyUserManagement';
import LocalAgencyUserManagement from '@/pages/LocalAgencyUserManagement';
import LocalAgencyPayments from '@/pages/LocalAgencyPayments';
import AdminChatViewer from '@/pages/AdminChatViewer';
import AdminAttendance from '@/pages/AdminAttendance';
import AdminTrainingMap from '@/pages/AdminTrainingMap';
import AdminIntegrity from '@/pages/AdminIntegrity';
import AgencyClearance from '@/pages/AgencyClearance';
import AgencyClearanceTracker from '@/pages/AgencyClearanceTracker';
import AgencyCandidateIntroductions from '@/pages/AgencyCandidateIntroductions';
import AdminProfileApprovals from '@/pages/AdminProfileApprovals';
import AdminAuthorizationCodes from '@/pages/AdminAuthorizationCodes';
import SuperadminSettings from '@/pages/SuperadminSettings';
import AgencyDashboard from '@/pages/AgencyDashboard';
import LocalAgencyDashboard from '@/pages/LocalAgencyDashboard';
import AuthPage from '@/pages/AuthPage';
import Signup from '@/pages/Signup';
import TrackingPage from '@/pages/TrackingPage';
import ChechePayReturnPage from '@/pages/ChechePayReturnPage';
import ViewerDashboard from '@/pages/ViewerDashboard';
import StaffTasksPage from '@/pages/StaffTasksPage';
import ForeignStaffTasksPage from '@/pages/ForeignStaffTasksPage';
import ReviewTasksPage from '@/pages/ReviewTasksPage';
import StakeholderGuide from '@/pages/StakeholderGuide';
import PaymentHistoryPage from '@/pages/PaymentHistoryPage';
import NotificationsPage from '@/pages/NotificationsPage';
import AgencyConversationPage from '@/pages/AgencyConversationPage';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient();

if (typeof window !== 'undefined') {
  window.addEventListener('supabase-data-changed', () => { void queryClient.resetQueries(); });
  window.addEventListener('supabase-sync-error', event => toast.error((event as CustomEvent<{ message: string }>).detail.message));
}

import { PresenceProvider } from '@/hooks/use-presence';
import { PageMemoryProvider } from '@/hooks/use-page-memory';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, userRole, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated || !userRole) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(String(userRole))) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
};

const CandidateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole, candidateTrackingCode, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated || userRole !== 'candidate' || !candidateTrackingCode) return <Navigate to="/login?tab=candidate" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <>
  <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/track" element={<Navigate to="/login?tab=candidate" replace />} />
    <Route path="/track/:trackingCode" element={<CandidateRoute><TrackingPage /></CandidateRoute>} />
    <Route path="/public-track/:trackingCode" element={<TrackingPage />} />
    <Route path="/payment/return" element={<ChechePayReturnPage />} />
    <Route path="/payment/return/:txRef" element={<ChechePayReturnPage />} />

    <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/candidate/:candidateId" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AdminCandidateDetail /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/chat" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AdminChatViewer /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/agency-chat" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AgencyConversationPage /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/tasks" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><StaffTasksPage /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><PaymentHistoryPage /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/clearance" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AgencyClearance /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/profile-approvals" element={<ProtectedRoute allowedRoles={['superadmin']}><AdminLayout><AdminProfileApprovals /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['superadmin']}><AdminLayout><AdminUserManagement /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/attendance" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AdminAttendance /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/training-map" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AdminLayout><AdminTrainingMap /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/integrity" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff', 'auditor']}><AdminLayout><AdminIntegrity /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/auth-codes" element={<ProtectedRoute allowedRoles={['superadmin']}><AdminLayout><AdminAuthorizationCodes /></AdminLayout></ProtectedRoute>} />
    <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminLayout><SuperadminSettings /></AdminLayout></ProtectedRoute>} />

    <Route path="/local-agency" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><LocalAgencyDashboard /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/tasks" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><StaffTasksPage /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/users" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><LocalAgencyUserManagement /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/payments" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><LocalAgencyPayments /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/clearance" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><AgencyClearance /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/training-map" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><AdminTrainingMap /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/chat" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><AdminChatViewer /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/agency-chat" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><AgencyConversationPage /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/attendance" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><AdminAttendance /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/local-agency/candidate/:candidateId" element={<ProtectedRoute allowedRoles={['local-agency']}><LocalAgencyLayout><AdminCandidateDetail /></LocalAgencyLayout></ProtectedRoute>} />
    <Route path="/agency" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AgencyDashboard /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/tasks" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><ForeignStaffTasksPage /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/introductions" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AgencyCandidateIntroductions /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/training-map" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AdminTrainingMap /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/clearance" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AgencyClearanceTracker /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/payments" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><PaymentHistoryPage /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/users" element={<ProtectedRoute allowedRoles={['foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AgencyUserManagement /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/chat" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AgencyConversationPage /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/candidate-chat" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AdminChatViewer /></AgencyLayout></ProtectedRoute>} />
    <Route path="/agency/candidate/:candidateId" element={<ProtectedRoute allowedRoles={['agency', 'foreign-agency', 'foreign-agency-staff']}><AgencyLayout><AdminCandidateDetail /></AgencyLayout></ProtectedRoute>} />
    <Route path="/viewer" element={<ProtectedRoute allowedRoles={['viewer', 'superadmin']}><ViewerDashboard /></ProtectedRoute>} />
    <Route path="/auditor" element={<ProtectedRoute allowedRoles={['auditor', 'superadmin']}><AuditorLayout><AdminIntegrity /></AuditorLayout></ProtectedRoute>} />
    <Route path="/auditor/tasks" element={<ProtectedRoute allowedRoles={['auditor']}><ReviewTasksPage /></ProtectedRoute>} />
    <Route path="/viewer/tasks" element={<ProtectedRoute allowedRoles={['viewer']}><ReviewTasksPage /></ProtectedRoute>} />
    <Route path="/guide" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff', 'agency', 'local-agency', 'foreign-agency', 'foreign-agency-staff', 'candidate', 'viewer', 'auditor']}><StakeholderGuide /></ProtectedRoute>} />
    <Route path="/notifications" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff', 'local-agency', 'foreign-agency', 'foreign-agency-staff', 'candidate', 'viewer', 'auditor']}><NotificationsPage /></ProtectedRoute>} />

    <Route path="/unauthorized" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
  <PortalWalkthrough />
  </>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="dawm-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <PresenceProvider>
          <LayoutEditProvider>
            <BrowserRouter><PageMemoryProvider><CandidateQuickViewProvider><AppRoutes /></CandidateQuickViewProvider></PageMemoryProvider></BrowserRouter>
          </LayoutEditProvider>
          </PresenceProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
