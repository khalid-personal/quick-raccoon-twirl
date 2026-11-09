import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import TravelOverviewMap from '@/components/TravelOverviewMap';
import { useAuth } from '@/lib/auth-context';
import { getCandidateStages, getCandidates, getDocuments, getForeignAgencies, getLocalAgencies, getMedicalResults, getCocFacilities } from '@/lib/data-store';
import { PHASE_META, TravelPhase, buildTravelEntries } from '@/lib/travel-phase';
import { currentJourneyEvents } from '@/lib/journey-control';
import JourneyControlMap from './JourneyControlMap';
import { Eye, Plane } from 'lucide-react';
import FlightDetailsDialog from '@/components/FlightDetailsDialog';
import FlightTrackerDialog from '@/components/FlightTrackerDialog';
import CandidateQuickView from '@/components/CandidateQuickView';
import CandidateAvatar from '@/components/CandidateAvatar';

const selectClass = 'h-9 rounded-md border bg-background px-2 text-sm';

// Role-aware map of where candidates are going, colour-coded by travel phase, with deployment overrides.
const DestinationTracker: React.FC = () => {
  const { userRole, user, viewAs, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [localFilter, setLocalFilter] = React.useState('');
  const [foreignFilter, setForeignFilter] = React.useState('');
  const [phaseFilter, setPhaseFilter] = React.useState<TravelPhase | ''>('');
  const [place, setPlace] = React.useState<string | null>(null);
  const [quickId, setQuickId] = React.useState<string | null>(null);
  const [trackId, setTrackId] = React.useState<string | null>(null);
  const [flightEditId, setFlightEditId] = React.useState<string | null>(null);

  const isForeign = userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'agency';
  const isLocal = userRole === 'local-agency';
  const isAssignedStaff = userRole === 'staff';
  const staffId = viewAs?.userId ?? user?.id;

  const { data } = useQuery({
    queryKey: ['destinationTracker'],
    queryFn: async () => ({
      candidates: getCandidates(), stages: getCandidateStages(), documents: getDocuments(),
      locals: getLocalAgencies(), foreigns: getForeignAgencies(), medical: getMedicalResults(), facilities: getCocFacilities(),
    }),
    refetchInterval: 15000,
  });

  const scoped = (data?.candidates ?? []).filter(c =>
    (isForeign ? !!userForeignAgencyId && (c.foreign_agency_id === userForeignAgencyId || c.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)) : true)
    && (!isLocal || !!userLocalAgencyId && c.local_agency_id === userLocalAgencyId)
    && (!isAssignedStaff || !!staffId && (c.assigned_staff_id === staffId || data?.stages.some(stage => stage.candidate_id === c.id && stage.assigned_staff_id === staffId)))
    && (!localFilter || c.local_agency_id === localFilter)
    && (!foreignFilter || c.foreign_agency_id === foreignFilter));
  const allEntries = buildTravelEntries(scoped, data?.stages ?? [], data?.documents ?? []);
  const entries = allEntries.filter(e => !phaseFilter || e.phase === phaseFilter);
  const visible = entries.filter(e => !place || e.destination.label === place);
  const counts = (Object.keys(PHASE_META) as TravelPhase[]).map(p => ({ phase: p, n: allEntries.filter(e => e.phase === p).length }));
  const nameOf = (list: { id: string; name: string }[] | undefined, id?: string) => list?.find(a => a.id === id)?.name ?? '—';
  const byId = (id: string | null) => (id ? data?.candidates.find(candidate => candidate.id === id) ?? null : null);

  const positions = currentJourneyEvents(scoped, data?.stages ?? [], data?.medical ?? [], data?.documents ?? [], data?.facilities ?? []);

  return (
    <Card data-tour="deployment-map">
      <CardHeader><CardTitle>Where candidates are going</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <section aria-label="All candidate stage positions" className="space-y-3"><h3>Ministry stage positions · {positions.length} candidates</h3><JourneyControlMap events={positions} running={false} onSelect={event => setQuickId(event.candidateId)} /><p className="text-muted-foreground">{positions.filter(event => event.point).length} located · {positions.filter(event => !event.point).length} awaiting ministry location</p></section>
        <div className="flex flex-wrap items-center gap-2">
          {!isLocal && (
            <select aria-label="Local agency" className={selectClass} value={localFilter} onChange={e => setLocalFilter(e.target.value)}>
              <option value="">All local agencies</option>
              {data?.locals.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {!isForeign && (
            <select aria-label="Foreign agency" className={selectClass} value={foreignFilter} onChange={e => setForeignFilter(e.target.value)}>
              <option value="">All foreign agencies</option>
              {data?.foreigns.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select aria-label="Phase" className={selectClass} value={phaseFilter} onChange={e => setPhaseFilter(e.target.value as TravelPhase | '')}>
            <option value="">All phases</option>
            {counts.map(c => <option key={c.phase} value={c.phase}>{PHASE_META[c.phase].label}</option>)}
          </select>
          {place && <Button variant="outline" size="sm" onClick={() => setPlace(null)}>Clear: {place}</Button>}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {counts.map(c => (
            <span key={c.phase} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: PHASE_META[c.phase].color }} />
              {PHASE_META[c.phase].label} ({c.n})
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><TravelOverviewMap entries={entries} selectedLabel={place ?? undefined} onSelect={setPlace} /></div>
          <div className="relative max-h-[520px] min-h-[320px] overflow-auto rounded-md border lg:max-h-none lg:overflow-hidden">
            <div className="overflow-auto lg:absolute lg:inset-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left sticky top-0">
                <tr><th className="p-2">Candidate</th><th className="p-2">Destination</th><th className="p-2">Agencies</th><th className="p-2">Phase</th><th className="p-2">Source</th></tr>
              </thead>
              <tbody>
                {visible.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No candidates with a destination yet.</td></tr>}
                {visible.map(({ candidate: c, phase, destination }) => (
                  <tr key={c.id} className="border-t align-top">
                    <td className="p-2 font-medium">
                      <span className="flex items-center gap-2">
                        <CandidateAvatar candidate={c} className="h-9 w-9" />
                        <span>
                        <button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setQuickId(c.id)}>{c.first_name} {c.last_name}</button>
                        {phase === 'transit' && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Track flight for ${c.first_name} ${c.last_name}`} title="Track flight" onClick={() => setTrackId(c.id)}><Eye className="h-4 w-4" /></Button>}
                        </span>
                      </span>
                      {c.flight && <div className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><Plane className="h-3 w-3" />{c.flight.flight_number} · {c.flight.departure_airport} → {c.flight.arrival_airport}</div>}
                      {c.employment_history?.length ? <div className="text-xs font-normal text-amber-700">{c.employment_history.some(journey => journey.reapplied_at) ? c.arrival ? 'Reapplied · redeployed' : 'Returned · reapplied' : 'Returned · eligible to reapply'}</div> : null}
                    </td>
                    <td className="p-2">{destination.label}</td>
                    <td className="p-2 text-xs text-muted-foreground">{nameOf(data?.locals, c.local_agency_id)}<br />{nameOf(data?.foreigns, c.foreign_agency_id)}</td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PHASE_META[phase].color }} />{PHASE_META[phase].label}
                      </span>
                      {c.arrival && phase !== 'returned' && <div className="text-xs text-muted-foreground">by {c.arrival.confirmed_by} · {new Date(c.arrival.arrived_at).toLocaleDateString()}</div>}
                    </td>
                      <td className="p-2">
                        <span className="text-muted-foreground">Ministry update</span>
                        {c.flight && <Button size="sm" variant="outline" onClick={() => setFlightEditId(c.id)}>View flight</Button>}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </CardContent>
      <CandidateQuickView candidateId={quickId} onOpenChange={open => !open && setQuickId(null)} onTrackFlight={id => { setQuickId(null); setTrackId(id); }} />
      <FlightTrackerDialog candidate={byId(trackId)} onOpenChange={open => !open && setTrackId(null)} />
      {byId(flightEditId) && <FlightDetailsDialog candidate={byId(flightEditId)!} open onOpenChange={open => !open && setFlightEditId(null)} />}
    </Card>
  );
};

export default DestinationTracker;
