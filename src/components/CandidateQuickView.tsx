import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ExternalLink, Eye, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ALL_STAGES } from '@/lib/types';
import { calculateProgress } from '@/lib/utils-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CandidateAvatar from './CandidateAvatar';
import ProgressIndicator from './ProgressIndicator';

const DONE = ['Passed', 'Issued', 'Completed'];

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{children || '—'}</dd></div>
);

interface Props {
  candidateId: string | null;
  onOpenChange: (open: boolean) => void;
  onTrackFlight?: (candidateId: string) => void;
}

const CandidateQuickView: React.FC<Props> = ({ candidateId, onOpenChange, onTrackFlight }) => {
  const { userRole } = useAuth();
  const { data: candidate, isLoading, isError } = useQuery({
    queryKey: ['candidateQuickView', candidateId],
    queryFn: () => api.getCandidateDetail(candidateId!),
    enabled: !!candidateId,
  });
  const profilePath = !candidate ? null
    : userRole === 'local-agency' ? `/local-agency/candidate/${candidate.id}`
    : userRole === 'superadmin' || userRole === 'staff' ? `/admin/candidate/${candidate.id}` : null;
  const activeStage = candidate?.stages.find(stage => !DONE.includes(stage.status));
  const phase = candidate ? (activeStage ? `${ALL_STAGES.find(stage => stage.id === activeStage.stage_id)?.title ?? 'Stage'} · ${activeStage.status}` : 'Journey complete') : '';
  const destination = candidate?.external_status?.destination_city
    ? `${candidate.external_status.destination_city}, ${candidate.external_status.destination_country ?? ''}` : candidate?.external_status?.destination_country;

  return (
    <Dialog open={!!candidateId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {isLoading ? (
          <div className="grid place-items-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : isError || !candidate ? (
          <DialogHeader><DialogTitle>Profile unavailable</DialogTitle><DialogDescription>The candidate profile could not be loaded.</DialogDescription></DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <CandidateAvatar candidate={candidate} className="h-14 w-14" />
                <div>
                  <DialogTitle>{candidate.first_name} {candidate.last_name}</DialogTitle>
                  <DialogDescription className="font-mono">{candidate.tracking_code}</DialogDescription>
                </div>
                <Badge variant="outline" className="ml-auto">{phase}</Badge>
              </div>
            </DialogHeader>
            <ProgressIndicator percent={calculateProgress(candidate.stages)} />
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Field label="Passport">{candidate.passport_number}</Field>
              <Field label="Date of birth">{candidate.dob ? format(new Date(candidate.dob), 'PP') : ''}</Field>
              <Field label="Phone">{candidate.phone_number}</Field>
              <Field label="Home city">{[candidate.home_city, candidate.home_region].filter(Boolean).join(', ')}</Field>
              <Field label="CoC center">{candidate.coc_facility_name}</Field>
              <Field label="Destination">{destination}</Field>
              <Field label="Local agency">{candidate.local_agency_name}</Field>
              <Field label="Foreign agency">{candidate.foreign_agency_name}</Field>
              <Field label="Employer">{candidate.employer?.company}</Field>
              <Field label="Visa">{candidate.visa ? `${candidate.visa.status.replace(/_/g, ' ')}${candidate.visa.expiry_date ? ` · expires ${candidate.visa.expiry_date}` : ''}` : ''}</Field>
              <Field label="Flight">{candidate.flight ? `${candidate.flight.flight_number} · ${candidate.flight.departure_airport} → ${candidate.flight.arrival_airport}` : ''}</Field>
              <Field label="Return status">{candidate.return_status?.replace(/-/g, ' ')}</Field>
            </dl>
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {onTrackFlight && <Button variant="outline" onClick={() => onTrackFlight(candidate.id)}><Eye className="mr-2 h-4 w-4" />Track flight</Button>}
              {profilePath && <Button asChild><Link to={profilePath}>Open full profile <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CandidateQuickView;
