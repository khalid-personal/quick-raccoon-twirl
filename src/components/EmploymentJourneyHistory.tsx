import React from 'react';
import { MapPin, Route } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import type { Candidate } from '@/lib/types';
import { practiceRecordLabel } from '@/lib/practice-record-label';

interface EmploymentJourneyHistoryProps {
  candidate: Candidate;
  showMap?: boolean;
}

const displayDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const EmploymentJourneyHistory: React.FC<EmploymentJourneyHistoryProps> = ({ candidate, showMap = true }) => <Card data-tour="return-history" className="overflow-hidden rounded-3xl border-primary/20">
  <CandidateCheckpoint eyebrow="Past work and travel" title="Employment journey" description="Follow recorded departures, destinations and returns without losing earlier employment history." icon={Route} metric={candidate.employment_history?.length ?? 0} metricLabel="Recorded journeys" />
  <CardContent className="space-y-4 p-5 sm:p-7">
    {candidate.employment_history?.length ? candidate.employment_history.map((journey, index) => {
      const destination = [journey.destination_city, journey.destination_country].filter(Boolean).join(', ');
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
      return <article key={`${journey.departed_at}-${index}`} className="grid gap-3 border-l-2 border-primary/30 pl-4 sm:grid-cols-[1fr_auto]">
        <div><p className="font-medium">{practiceRecordLabel(journey.employer_name, candidate.id.startsWith('demo-')) || destination || 'Employment journey'}</p><p className="text-sm text-muted-foreground">{journey.home_city} to {destination}</p><p className="mt-1 text-xs text-muted-foreground">Departed {displayDate(journey.departed_at)}{journey.returned_at ? ` · Returned ${displayDate(journey.returned_at)}` : ''}</p>{journey.contract_reference && <p className="text-xs text-muted-foreground">Contract {practiceRecordLabel(journey.contract_reference, candidate.id.startsWith('demo-'))}</p>}</div>
        {showMap && <a className="inline-flex items-center gap-1 text-sm underline underline-offset-2" href={mapUrl} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4" />Map</a>}
      </article>;
    }) : <p className="text-sm text-muted-foreground">No completed employment journeys recorded.</p>}
  </CardContent>
</Card>;

export default EmploymentJourneyHistory;
