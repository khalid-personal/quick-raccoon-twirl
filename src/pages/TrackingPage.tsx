import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProgressIndicator from '@/components/ProgressIndicator';
import TrackingTimeline from '@/components/TrackingTimeline';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TrackingPage: React.FC = () => {
  const { trackingCode } = useParams<{ trackingCode: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicTracking', trackingCode],
    queryFn: () => api.getPublicTrackingData(trackingCode!),
    enabled: !!trackingCode,
    // Simulate real-time refresh (polling)
    refetchInterval: 5000, 
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

  if (isLoading) {
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
          <Link to="/track">
            <Button className="mt-4">
              Try Another Code
            </Button>
          </Link>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Application Status: {data.candidate_name}</CardTitle>
          <p className="text-lg text-muted-foreground">Tracking Code: <span className="font-mono font-semibold">{data.tracking_code}</span></p>
        </CardHeader>
        <CardContent>
          <ProgressIndicator percent={data.progress_percent} className="mb-8" />
          
          <h2 className="text-2xl font-bold mb-6 border-b pb-2">Deployment Timeline</h2>
          
          <TrackingTimeline timeline={data.timeline} isPublicView={true} />
          
          <div className="mt-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="text-xl font-semibold mb-2">Important Notes for Family/Parents</h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>Medical results are summarized as Passed, Failed, or Pending for privacy compliance.</li>
              <li>If the final stage is blocked, please contact your agency representative.</li>
              <li>This page refreshes automatically every 5 seconds.</li>
            </ul>
          </div>
          
          <div className="mt-6 text-center space-y-4">
            {/* Printable Progress Sheet Button */}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Generate Printable Progress Sheet (Mock)
            </Button>
            
            {/* Back Button */}
            <Link to="/track" className="block">
              <Button variant="secondary">Track Another Application</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackingPage;