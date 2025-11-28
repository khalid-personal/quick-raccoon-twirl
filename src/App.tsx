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
import AdminChatViewer from "./pages/AdminChatViewer"; // NEW IMPORT
import AgencyDashboard from "./pages/AgencyDashboard"; // NEW IMPORT
import AdminAuthorizationCodes from "./pages/AdminAuthorizationCodes"; // NEW IMPORT
import { AuthProvider, useAuth } from "./lib/auth";
import AdminLayout from "./components/AdminLayout";
import { Loader2 } from 'lucide-react'; // Added Loader2 import

const queryClient = new QueryClient();

// Component to protect Admin routes
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!isAuthenticated || (userRole !== 'admin' && userRole !== 'staff')) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Component to protect Candidate tracking route
const CandidateProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, candidateTrackingCode, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!isAuthenticated || userRole !== 'candidate' || !candidateTrackingCode) {
    // Redirect non-candidates or unauthenticated users to login
    return <Navigate to="/login?tab=candidate" replace />;
  }
  
  return children;
};

// Component to protect Agency routes
const AgencyProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, userRole, isLoading, userForeignAgency } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated || userRole !== 'agency' || !userForeignAgency) {
    return <Navigate to="/login" replace />;
  }
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
      
      {/* Candidate Tracking Route (Protected) */}
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
      
      {/* Admin Routes (Protected) */}
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
      
      {/* Agency Portal Route (Protected) */}
      <Route 
        path="/agency" 
        element={
          <AgencyProtectedRoute>
            <AgencyDashboard />
          </AgencyProtectedRoute>
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