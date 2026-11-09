import React from 'react';
import { CheckCircle2, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import type { Candidate, PublicTrackingData } from '@/lib/types';
import EthiopiaMap, { MapLink } from './EthiopiaMap';
import RouteMap from './RouteMap';
import { Badge } from '@/components/ui/badge';
import { departureRequirements } from '@/lib/departure-readiness';
import { getCandidateStages, getMedicalResults, getDocuments, getCocFacilities } from '@/lib/data-store';
import { currentJourneyEvents, buildJourneyControlEvents } from '@/lib/journey-control';
import JourneyControlMap from './JourneyControlMap';

interface Props {
  journey?: PublicTrackingData['journey'];
  candidateId?: string;
  candidate?: Candidate;
  canConfirmArrival?: boolean;
  returnedHome?: boolean;
  onChanged?: () => void;
}

const CandidateJourneyMap: React.FC<Props> = ({ journey, candidate, returnedHome = false }) => {
  const [selectedEvent, setSelectedEvent] = React.useState('');
  const home = journey?.home;
  const facility = journey?.facility;
  const destination = journey?.destination;
  const center = journey?.center;
  const employer = candidate?.external_status?.work_contract ? candidate.employer : undefined;
  if (!candidate && !home && !facility && !destination && !center && !journey?.home_city) return null;

  const arrived = !!journey?.arrived_at;
  const positions = candidate ? currentJourneyEvents([candidate], getCandidateStages(), getMedicalResults(), getDocuments(), getCocFacilities()) : [];
  const history = candidate ? buildJourneyControlEvents([candidate], getCandidateStages(), getMedicalResults(), getDocuments(), getCocFacilities()) : [];

  const links: MapLink[] = [];
  if (home && facility) links.push({ id: 'to-facility', from: home, to: facility });

  return (
    <Card data-tour="candidate-journey">
      <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> My Journey Map</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {candidate && <section aria-label="Current ministry journey" className="space-y-3"><h3>{positions[0]?.title} · {positions[0]?.status}</h3><p className="text-muted-foreground">{positions[0]?.point?.label || 'Awaiting ministry location'}</p><JourneyControlMap events={[...history, ...positions]} selectedEvent={selectedEvent || positions[0]?.id} running={false} onSelect={event => setSelectedEvent(event.id)} />{selectedEvent && <p>{[...history, ...positions].find(event => event.id === selectedEvent)?.title}</p>}</section>}
        <p className="text-sm text-muted-foreground">
          {home ? `Home city: ${home.label}.` : journey?.home_city ? `Home city: ${journey.home_city} (map coordinates unavailable).` : 'Your home city has not been set yet.'}
          {journey?.home_region ? ` Region: ${journey.home_region}.` : ''}
          {facility ? ` Your training is at ${facility.label}.` : ''}
          {destination ? ` Work destination: ${destination.label}.` : ' Your destination will appear once your work contract is received.'}
        </p>
        {returnedHome ? <p className="flex items-center gap-2 text-sm font-medium text-amber-700"><CheckCircle2 className="h-4 w-4" /> You have returned home.</p>
          : arrived && <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> You have arrived{journey?.arrived_at ? ` on ${new Date(journey.arrived_at).toLocaleDateString()}` : ''}. Deployment is complete.</p>}
        {candidate && !arrived && !returnedHome && <section className="space-y-2 border-l-4 border-amber-500 bg-amber-500/10 p-3" aria-label="Departure readiness">
          <h3 className="text-sm font-semibold">Departure requirements</h3>
          <ul className="flex flex-wrap gap-2">{departureRequirements(candidate).map(requirement => <li key={requirement.key}><Badge variant={requirement.ready ? 'outline' : 'secondary'}>{requirement.label}: {requirement.ready ? 'Recorded' : 'Pending'}</Badge></li>)}</ul>
          <p className="text-sm text-muted-foreground">Deployment and arrival update from the ministry.</p>
        </section>}
        <section className="space-y-3 border-t pt-4" aria-label="Home to CoC journey">
          <h3 className="text-base font-semibold">Home to CoC center</h3>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
            <div className="min-w-0">{home || facility ? <EthiopiaMap facilities={facility ? [facility] : []} links={links} youAreHere={home} /> : <p className="py-8 text-sm text-muted-foreground">Map coordinates are not recorded.</p>}</div>
            <aside className="min-w-0 space-y-5 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <section className="space-y-2"><h4 className="text-sm font-semibold">Candidate origin</h4><dl className="space-y-2 text-sm">
                {candidate && <div><dt className="text-muted-foreground">Candidate</dt><dd className="break-words font-medium">{candidate.first_name} {candidate.last_name}</dd><dd className="font-mono text-xs text-muted-foreground">{candidate.tracking_code}</dd></div>}
                <div><dt className="text-muted-foreground">Home city / region</dt><dd className="break-words">{[journey?.home_city || home?.label, journey?.home_region].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
                {candidate?.phone_number && <div><dt className="text-muted-foreground">Candidate phone</dt><dd className="break-all">{candidate.phone_number}</dd></div>}
              </dl></section>
              <section className="space-y-3 border-t pt-4"><h4 className="text-sm font-semibold">Assigned CoC: {center?.name || 'Not assigned'}</h4><Badge variant="outline">Training: {journey?.training_status ?? 'Not recorded'}</Badge>
                {center && <dl className="space-y-2 text-sm"><div><dt className="text-muted-foreground">Center city</dt><dd>{center.city || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Address</dt><dd className="break-words">{center.address || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="break-all">{center.phone_number || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{center.contact_email || 'Not recorded'}</dd></div></dl>}
                {center?.gps_url && <Button asChild size="sm" variant="outline"><a href={center.gps_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open CoC location</a></Button>}
                {center && !facility && <p className="text-xs text-muted-foreground">Center coordinates are not recorded.</p>}
              </section>
            </aside>
          </div>
        </section>
        {destination && <section className="space-y-3 border-t pt-4" aria-label="Work destination journey"><h3 className="text-base font-semibold">Journey to your work destination</h3>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
            <div className="min-w-0">{home || facility ? <RouteMap origin={(home || facility)!} destination={destination} waypoints={home && facility ? [facility] : []} showReturn={returnedHome} compact /> : <p className="py-8 text-sm text-muted-foreground">Origin coordinates are not recorded.</p>}</div>
            <aside className="min-w-0 space-y-3 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><h4 className="text-sm font-semibold">Foreign employer</h4><dl className="space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Work destination</dt><dd className="break-words">{destination.label}</dd></div>
              {employer ? <>
                <div><dt className="text-muted-foreground">Company / household</dt><dd className="break-words font-medium">{employer.company || 'Not recorded'}</dd></div>
                <div><dt className="text-muted-foreground">Contact person</dt><dd className="break-words">{[employer.contact_name, employer.role].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
                <div><dt className="text-muted-foreground">Phone</dt><dd className="break-all">{employer.phone || 'Not recorded'}</dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{employer.email || 'Not recorded'}</dd></div>
                <div><dt className="text-muted-foreground">Address</dt><dd className="break-words">{employer.address || 'Not recorded'}</dd></div>
              </> : <div><dd className="text-muted-foreground">{candidate ? 'Employer details have not been recorded for this contract.' : 'Employer contact details are available in the candidate account.'}</dd></div>}
            </dl><Badge variant="outline">Deployment: {journey?.deployment_status || 'Not recorded'}</Badge></aside>
          </div>
        </section>}
      </CardContent>
    </Card>
  );
};

export default CandidateJourneyMap;
