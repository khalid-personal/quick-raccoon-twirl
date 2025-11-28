import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProgressIndicator from '@/components/ProgressIndicator';
import TrackingTimeline from '@/components/TrackingTimeline';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth'; // Import useAuth
import CandidateChat from '@/components/CandidateChat'; // NEW IMPORT
import CandidateDocumentUploader from '@/components/CandidateDocumentUploader'; // NEW IMPORT
import { format } from 'date-fns';
import { CandidateDetail } from '@/lib/types'; // Import CandidateDetail

const TrackingPage: React.FC = () => {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const { candidateTrackingCode, userRole, logout } = useAuth(); // Get logged-in candidate's code
  
  const isCandidateAuthenticated = userRole === 'candidate';

  // Security check: If the user is a candidate, ensure the URL matches their code
  if (isCandidateAuthenticated && trackingCode !== candidateTrackingCode) {
    // Redirect to their correct tracking page if they try to access another one
    toast.error("Access denied to this tracking code.");
    return <Navigate to={`/track/${candidateTrackingCode}`} replace />;
  }
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publicTracking', trackingCode],
    queryFn: () => api.getPublicTrackingData(trackingCode!),
    enabled: !!trackingCode,
    // Simulate real-time refresh (polling)
    refetchInterval: 5000, 
  });
  
  // We need the full candidate detail to get the ID and email for the chat/uploader component
  const { data: candidateDetail, isLoading: isLoadingDetail } = useQuery<CandidateDetail | null>({
    queryKey: ['candidateDetailByTrackingCode', trackingCode],
    queryFn: () => api.getCandidateDetailByTrackingCode(trackingCode!),
    enabled: !!trackingCode && isCandidateAuthenticated, // Only fetch full detail if candidate is logged in
  });
  
  const handlePrint = async () => {
    if (!trackingCode) return;
    try {
      // Mock API call
      await api.generatePrintableSheet(trackingCode);
      toast.success("Printable sheet generated successfully (Check console for mock data).");
    } catch (e) {
      toast.error("Failed to generate printable sheet.");
    }
  };

  if (isLoading || (isCandidateAuthenticated && isLoadingDetail)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tracking Error</AlertTitle>
          <AlertDescription>
            {error ? (error as Error).message : `Tracking code "${trackingCode}" not found or invalid.`}
          </AlertDescription>
          <Link to="/login">
            <Button className="mt-4">
              Return to Login
            </Button>
          </Link>
        </Alert>
      </div>
    );
  }
  
  // Use candidateDetail for sensitive info if available (i.e., if candidate is logged in)
  const displayCandidateDetail = isCandidateAuthenticated ? candidateDetail : null;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Application Status: {data.candidate_name}</CardTitle>
          <p className="text-lg text-muted-foreground">Tracking Code: <span className="font-mono font-semibold">{data.tracking_code}</span></p>
          
          {/* Display Sensitive Info if Authenticated as Candidate */}
          {displayCandidateDetail && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2 border-t mt-2">
                <div>
                    <p className="font-medium text-muted-foreground">Passport</p>
                    <p className="font-semibold">{displayCandidateDetail.passport_number}</p>
                </div>
                <div>
                    <p className="font-medium text-muted-foreground">Date of Birth</p>
                    <p className="font-semibold">{format(new Date(displayCandidateDetail.dob), 'PPP')}</p>
                </div>
                <div>
                    <p className="font-medium text-muted-foreground">Email</p>
                    <p className="font-semibold">{displayCandidateDetail.email}</p>
                </div>
                <div>
                    <p className="font-medium text-muted-foreground">Phone</p>
                    <p className="font-semibold">{displayCandidateDetail.phone_number || 'N/A'}</p>
                </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ProgressIndicator percent={data.progress_percent} className="mb-8" />
          
          <h2 className="text-2xl font-bold mb-6 border-b pb-2">Deployment Timeline</h2>
          
          <TrackingTimeline 
            timeline={data.timeline} 
            isPublicView={true} 
            trackingCode={data.tracking_code}
            candidateId={displayCandidateDetail?.id} // Pass candidate ID if available
            refetch={refetch}
          />
          
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Candidate Document Uploader (Only visible if authenticated) */}
            {displayCandidateDetail && (
                <CandidateDocumentUploader
                    candidateId={displayCandidateDetail.id}
                    timeline={data.timeline}
                    existingDocuments={displayCandidateDetail.documents}
                    refetch={refetch}
                />
            )}
            
            {/* Chat Component */}
            {displayCandidateDetail && (
                <CandidateChat 
                    candidateId={displayCandidateDetail.id}
                    candidateName={data.candidate_name}
                    candidateEmail={displayCandidateDetail.email}
                />
            )}
            
            {/* Important Notes (Fallback if not authenticated) */}
            {!displayCandidateDetail && (
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 h-full">
                    <h3 className="text-xl font-semibold mb-2">Important Notes for Family/Parents</h3>
                    <ul className="list-disc list-inside text-sm space-y-1 text-gray-600 dark:text-gray-400">
                        <li>Medical results are summarized as Passed, Failed, or Pending for privacy compliance.</li>
                        <li>If the final stage is blocked, please contact your agency representative.</li>
                        <li>This page refreshes automatically every 5 seconds.</li>
                    </ul>
                </div>
            )}
          </div>
          
          <div className="mt-6 text-center space-y-4">
            {/* Printable Progress Sheet Button */}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Generate Printable Progress Sheet (Mock)
            </Button>
            
            {/* Logout Button */}
            <Button variant="secondary" onClick={logout}>Logout</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackingPage;