import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { Candidate } from '@/lib/types';
import CandidateJourneyMap from './CandidateJourneyMap';

interface CandidateMapDialogProps {
  candidate: Candidate;
}

const CandidateMapDialog: React.FC<CandidateMapDialogProps> = ({ candidate }) => {
  const [open, setOpen] = React.useState(false);
  const { data: tracking, isLoading, error } = useQuery({
    queryKey: ['candidateJourneyMap', candidate.tracking_code],
    queryFn: () => api.getPublicTrackingData(candidate.tracking_code),
    enabled: open,
  });

  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" size="icon" aria-label="View candidate journey map" title="View candidate journey map" onClick={() => setOpen(true)}>
      <MapPin className="h-4 w-4" />
    </Button>
    <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Candidate journey map</DialogTitle>
        <DialogDescription>{candidate.first_name} {candidate.last_name} · {candidate.tracking_code}</DialogDescription>
      </DialogHeader>
      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading journey map…</p>}
      {error && <p role="alert" className="py-4 text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load the candidate journey map.'}</p>}
      {tracking && <CandidateJourneyMap journey={tracking.journey} candidate={candidate} />}
    </DialogContent>
  </Dialog>;
};

export default CandidateMapDialog;
