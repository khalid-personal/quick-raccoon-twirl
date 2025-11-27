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
import Login from "./pages/Login";
import PublicTrackingInput from "./pages/PublicTrackingInput";
import { AuthProvider, useAuth } from "./lib/auth";
import AdminLayout from "./components/AdminLayout";

const queryClient = new QueryClient();

// Component to protect routes
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
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
      <Route path="/login" element={<Login />} />
      <Route path="/track" element={<PublicTrackingInput />} />
      <Route path="/track/:trackingCode" element={<TrackingPage />} />
      
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