import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import TrackingPage from "./pages/TrackingPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCandidateDetail from "./pages/AdminCandidateDetail";
import AuthPage from "./pages/AuthPage";
import Signup from "./pages/Signup"; 
import SuperadminSettings from "./pages/SuperadminSettings";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminChatViewer from "./pages/AdminChatViewer";
import AgencyDashboard from "./pages/AgencyDashboard";
import AdminAuthorizationCodes from "./pages/AdminAuthorizationCodes";
import AdminAttendance from "./pages/AdminAttendance";
import LocalAgencyDashboard from "./pages/LocalAgencyDashboard";
import { AuthProvider, useAuth } from "./lib/auth";
import AdminLayout from "./components/AdminLayout";
import LocalAgencyLayout from "./components/LocalAgencyLayout";
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

// Component to protect Admin/Staff routes
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect local-agency users to their specific dashboard
  if (userRole === 'local-agency') {
    return <Navigate to="/local-agency" replace />;
  }

  // Allow admin and staff to access admin routes
  if (userRole === 'admin' || userRole === 'staff') {
    return children;
  }

  // For any other authenticated but unauthorized role, redirect to login
  return <Navigate to="/login" replace />;
};

// Component to protect Candidate tracking route
const CandidateProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, candidateTrackingCode, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!isAuthenticated || userRole !== 'candidate' || !candidateTrackingCode) {
    return <Navigate to="/login?tab=candidate" replace />;
  }
  
  return children;
};

// Component to protect Agency routes
const AgencyProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, isLoading, userForeignAgencyName } = useAuth(); // Renamed

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated || userRole !== 'agency' || !userForeignAgencyName) { // Renamed
    return <Navigate to="/login" replace />;
  }
  return children;
};

// NEW: Component to protect Local Agency routes
const LocalAgencyProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, isLoading, userLocalAgencyName } = useAuth(); // Renamed

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  console.log("[LocalAgencyProtectedRoute] Checking access:", { isAuthenticated, userRole, userLocalAgencyName }); // Renamed log

  if (!isAuthenticated || userRole !== 'local-agency' || !userLocalAgencyName) { // Renamed
    console.log("[LocalAgencyProtectedRoute] Redirecting: isAuthenticated:", isAuthenticated, "userRole:", userRole, "userLocalAgencyName:", userLocalAgencyName); // Renamed log
    return <Navigate to="/login" replace />;
  }
  console.log("[LocalAgencyProtectedRoute] Access granted. userLocalAgencyName:", userLocalAgencyName); // Renamed log
  return children;
};


const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      {/* Root path redirects to /login */}
      <Route path="/" element={<Index />} /> 
      
      {/* Public Routes */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Candidate Tracking Route (Protected for actual candidates) */}
      <Route 
        path="/track" 
        element={<Navigate to="/login?tab=candidate" replace />} 
      />
      <Route 
        path="/track/:trackingCode" 
        element={
          <CandidateProtectedRoute>
            <TrackingPage />
          </CandidateProtectedRoute>
        } 
      />

      {/* NEW: Public Tracking Test Route (Accessible to anyone, including admins for testing) */}
      <Route 
        path="/public-track/:trackingCode" 
        element={<TrackingPage />} 
      />
      
      {/* Admin Routes (Protected for admin/staff) */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/candidate/:candidateId" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <AdminCandidateDetail />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/chat" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <AdminChatViewer />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/settings" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <SuperadminSettings />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <AdminUserManagement />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/auth-codes" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <AdminAuthorizationCodes />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/attendance" 
        element={
          <ProtectedRoute>
            <AdminLayout>
              <AdminAttendance />
            </AdminLayout>
          </ProtectedRoute>
        } 
      />
      
      {/* Agency Portal Route (Protected) */}
      <Route 
        path="/agency" 
        element={
          <AgencyProtectedRoute>
            <AgencyDashboard />
          </AgencyProtectedRoute>
        } 
      />

      {/* NEW: Local Agency Portal Route (Protected) */}
      <Route 
        path="/local-agency" 
        element={
          <LocalAgencyProtectedRoute>
            <LocalAgencyLayout>
              <LocalAgencyDashboard />
            </LocalAgencyLayout>
          </LocalAgencyProtectedRoute>
        } 
      />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;