import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import CandidateProfile from '@/components/CandidateProfile';
import TimelineEditor from '@/components/TimelineEditor';
import DocumentManager from '@/components/DocumentManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CandidateDetailEditor from '@/components/CandidateDetailEditor';

const AdminCandidateDetail: React.FC = () => {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: candidate, isLoading, error, refetch } = useQuery({
    queryKey: ['candidateDetail', candidateId],
    queryFn: () => api.getCandidateDetail(candidateId!),
    enabled: !!candidateId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">Error Loading Candidate</h1>
        <p className="text-muted-foreground">Candidate ID {candidateId} not found.</p>
        <Link to="/admin">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {candidate.first_name} {candidate.last_name} 
          <span className="text-lg font-normal text-muted-foreground ml-3">({candidate.tracking_code})</span>
        </h1>
        <Link to="/admin">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      <CandidateProfile candidate={candidate} onEdit={() => setIsEditDialogOpen(true)} />

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Timeline Editor</TabsTrigger>
          <TabsTrigger value="documents">Document Manager</TabsTrigger>
          <TabsTrigger value="medical">Medical Results (Mock)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="timeline" className="mt-4">
          <TimelineEditor candidateDetail={candidate} refetch={refetch} />
        </TabsContent>
        
        <TabsContent value="documents" className="mt-4">
          <DocumentManager candidateDetail={candidate} refetch={refetch} />
        </TabsContent>
        
        <TabsContent value="medical" className="mt-4">
          {/* Placeholder for Medical Results Editor */}
          <div className="p-6 border rounded-lg bg-white dark:bg-gray-950">
            <h3 className="text-xl font-semibold mb-4">Medical Results Editor (Mock)</h3>
            <p className="text-muted-foreground">
              In a full system, this section would allow staff to input detailed medical results (HIV, Pregnancy, HepB, etc.) which directly influence the Final Medical Clearance stage status.
            </p>
            <p className="mt-2 text-sm text-red-500">
              Note: The compliance logic for pregnancy test failure blocking flight booking is already implemented in the mock API.
            </p>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Edit Candidate Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Candidate Details</DialogTitle>
          </DialogHeader>
          {candidate && (
            <CandidateDetailEditor 
              candidate={candidate} 
              onSuccess={refetch} 
              onClose={() => setIsEditDialogOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCandidateDetail;