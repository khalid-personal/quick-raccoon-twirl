import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowUpRight, Building2, Clock3, HeartPulse, MapPin, Pause, Play, RefreshCw, Search, ShieldCheck, SkipBack, SkipForward } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCandidates, getCandidateStages, getCocFacilities, getDocuments, getMedicalResults } from '@/lib/data-store';
import { useAuth } from '@/lib/auth-context';
import { ALL_STAGES } from '@/lib/types';
import { resolveEthiopianRegion, ETHIOPIAN_REGIONS } from '@/lib/ethiopia-regions';
import { buildJourneyControlEvents, currentJourneyEvents, type JourneyControlEvent, type JourneyEventKind } from '@/lib/journey-control';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { usePageMemory } from '@/hooks/use-page-memory';
import { useCandidateWorkspace } from '@/components/CandidateQuickViewProvider';
import JourneyControlMap from '@/components/JourneyControlMap';
import CandidateAvatar from '@/components/CandidateAvatar';
import CandidateQuickView from '@/components/CandidateQuickView';
import DestinationTracker from '@/components/DestinationTracker';
import EmploymentJourneyHistory from '@/components/EmploymentJourneyHistory';
import EditableGrid from '@/components/EditableGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const EVENT_FILTERS: Array<{ value: JourneyEventKind | 'all'; label: string }> = [
  { value: 'all', label: 'All evidence' }, { value: 'registration', label: 'Registration' },
  { value: 'training', label: 'Training' }, { value: 'medical', label: 'Medical' },
  { value: 'contract', label: 'Contracts' }, { value: 'deployment', label: 'Deployment' },
  { value: 'flight', label: 'Flights' }, { value: 'arrival', label: 'Arrivals' },
  { value: 'return', label: 'Returns' }, { value: 'document', label: 'Documents' },
];
const selectClass = 'h-11 min-w-0 rounded-xl border bg-card px-3 text-sm';
const timeLabel = (at?: string) => at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Date not recorded';

export default function AdminTrainingMap() {
  const { userRole, user, viewAs, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const workspace = useCandidateWorkspace();
  const queryClient = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const [selectedId, setSelectedId] = usePageMemory('training-map:control-candidate', '');
  const [region, setRegion] = usePageMemory('training-map:region', 'all');
  const [centerId, setCenterId] = usePageMemory('training-map:center', '');
  const [kind, setKind] = useState<JourneyEventKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const scopeKey = `${userRole}:${viewAs?.userId ?? user?.id}:${userLocalAgencyId}:${userForeignAgencyId}`;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['trainingMap', scopeKey],
    queryFn: async () => ({ candidates: getCandidates(), stages: getCandidateStages(), facilities: getCocFacilities(), documents: getDocuments(), medical: getMedicalResults() }),
    refetchInterval: 15000,
  });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['trainingMap'] }); };
    window.addEventListener('supabase-data-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [queryClient]);
  const candidates = useMemo(() => (data?.candidates ?? []).filter(candidate => {
    if (['foreign-agency', 'foreign-agency-staff', 'agency'].includes(userRole ?? '')) return !!userForeignAgencyId && (candidate.foreign_agency_id === userForeignAgencyId || !!candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId));
    if (userRole === 'local-agency') return !!userLocalAgencyId && candidate.local_agency_id === userLocalAgencyId;
    if (userRole === 'staff') {
      const id = viewAs?.userId ?? user?.id;
      return !!id && (candidate.assigned_staff_id === id || !!data?.stages.some(stage => stage.candidate_id === candidate.id && stage.assigned_staff_id === id));
    }
    return ['superadmin', 'admin', 'viewer', 'auditor'].includes(userRole ?? '');
  }), [data, userRole, userForeignAgencyId, userLocalAgencyId, viewAs?.userId, user?.id]);
  const facilities = data?.facilities ?? [];
  const visibleCandidates = candidates.filter(candidate => (region === 'all' || resolveEthiopianRegion(candidate.home_city, candidate.home_region) === region)
    && (!centerId || candidate.coc_facility_id === centerId)
    && `${candidate.first_name} ${candidate.last_name} ${candidate.tracking_code}`.toLowerCase().includes(search.toLowerCase()));
  const effectiveId = visibleCandidates.some(candidate => candidate.id === selectedId) ? selectedId : '';
  const filteredCandidates = effectiveId ? visibleCandidates.filter(candidate => candidate.id === effectiveId) : visibleCandidates;
  const allEvents = useMemo(() => buildJourneyControlEvents(candidates, data?.stages ?? [], data?.medical ?? [], data?.documents ?? [], data?.facilities ?? []), [candidates, data]);
  const positions = currentJourneyEvents(filteredCandidates, data?.stages ?? [], data?.medical ?? [], data?.documents ?? [], facilities);
  const ids = new Set(filteredCandidates.map(candidate => candidate.id));
  const events = allEvents.filter(event => ids.has(event.candidateId) && (kind === 'all' || event.kind === kind)
    && (!missingOnly || event.precision === 'missing')
    && (!from || !!event.at && event.at.slice(0, 10) >= from)
    && (!to || !!event.at && event.at.slice(0, 10) <= to));
  const selected = candidates.find(candidate => candidate.id === effectiveId);
  const cursor = replayIndex === null ? events.length - 1 : Math.min(replayIndex, events.length - 1);
  const playedEvents = replayIndex === null ? events : events.slice(0, cursor + 1);
  const mapEvents = effectiveId ? playedEvents : positions.filter(event => (kind === 'all' || event.kind === kind) && (!missingOnly || !event.point));
  const inspected = replayIndex !== null ? events[Math.max(0, cursor)] : events.find(event => event.id === selectedEventId) ?? events[Math.max(0, cursor)];
  const orderedEvents = [...events].reverse();
  const maxPage = Math.max(0, Math.ceil(events.length / 20) - 1);
  const safePage = Math.min(page, maxPage);
  const missing = events.filter(event => event.precision === 'missing').length;
  useEffect(() => { setPlaying(false); setReplayIndex(null); setPage(0); }, [effectiveId, region, centerId, kind, search, missingOnly, from, to]);
  useEffect(() => {
    if (!playing || reduced || !effectiveId || !events.length) return;
    const timer = window.setInterval(() => setReplayIndex(current => {
      const next = (current ?? -1) + 1;
      if (next >= events.length - 1) setPlaying(false);
      return Math.min(next, events.length - 1);
    }), 2200);
    return () => window.clearInterval(timer);
  }, [playing, reduced, effectiveId, events.length]);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  const openRecord = (event: JourneyControlEvent) => {
    if (workspace) workspace(event.candidateId, { tab: event.tab, stageId: event.stageId });
    else setQuickId(event.candidateId);
  };
  const selectEvent = (event: JourneyControlEvent) => { setSelectedId(event.candidateId); setSelectedEventId(event.id); setPlaying(false); };
  const step = (direction: number) => { setPlaying(false); setReplayIndex(Math.max(0, Math.min(events.length - 1, cursor + direction))); };
  const resetFilters = () => { setSelectedId(''); setRegion('all'); setCenterId(''); setKind('all'); setSearch(''); setMissingOnly(false); setFrom(''); setTo(''); setSelectedEventId(''); };
  return <div className="journey-control-room space-y-5">
    <header className="journey-control-command">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"><Activity className="h-4 w-4" />Workforce movement intelligence</p><h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Journey Control</h1><p className="mt-2 text-sm">Registration → Training → Medical → Deployment. Evidence, places and next actions.</p></div>
        <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh records</Button>
      </div>
      <div className="journey-control-status"><span><ShieldCheck className="h-4 w-4" />Ministry stage updates</span><span><Clock3 className="h-4 w-4" />{dataUpdatedAt ? `Checked ${new Date(dataUpdatedAt).toLocaleTimeString()}` : 'Loading records'}</span><span><HeartPulse className="h-4 w-4" />Every candidate accounted for</span></div>
    </header>
    <details className="portal-flow-guide"><summary>How to operate this room <span>One start-to-finish guide</span></summary><div className="grid gap-4 p-5 text-sm text-muted-foreground md:grid-cols-3"><p><strong className="block text-foreground">01 · Locate</strong>Explore current stages and ministry-supplied locations. Candidates awaiting a location remain in the roster.</p><p><strong className="block text-foreground">02 · Replay</strong>Step through dated ministry records and movement history.</p><p><strong className="block text-foreground">03 · Follow up</strong>Open the source record, review supporting evidence or investigate a flagged update. Stage progress is read-only.</p></div></details>
    {isError && <div role="alert" className="rounded-xl border border-destructive p-4 text-destructive">Journey records could not be loaded. Use Refresh records to retry.</div>}
    <section aria-label="Journey control filters" className="journey-control-filters">
      <label className="relative"><span className="sr-only">Search candidates</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Name or tracking code" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select className={selectClass} aria-label="Select candidate journey" value={effectiveId} onChange={event => { setSelectedId(event.target.value); setSelectedEventId(''); }}><option value="">Entire scoped network · {visibleCandidates.length}</option>{visibleCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name} · {candidate.tracking_code}</option>)}</select>
      <select className={selectClass} aria-label="Filter by Ethiopian region" value={region} onChange={event => setRegion(event.target.value)}><option value="all">All regions</option>{ETHIOPIAN_REGIONS.map(value => <option key={value}>{value}</option>)}</select>
      <select className={selectClass} aria-label="Filter by training center" value={centerId} onChange={event => setCenterId(event.target.value)}><option value="">All CoC centers</option>{facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select>
      <select className={selectClass} aria-label="Filter journey evidence" value={kind} onChange={event => setKind(event.target.value as JourneyEventKind | 'all')}>{EVENT_FILTERS.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select>
      <label className="flex items-center gap-2 text-xs">From<Input aria-label="Events from date" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label className="flex items-center gap-2 text-xs">To<Input aria-label="Events to date" type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></label>
      <Button variant={missingOnly ? 'default' : 'outline'} aria-pressed={missingOnly} onClick={() => setMissingOnly(value => !value)}><MapPin className="mr-2 h-4 w-4" />Awaiting ministry location</Button>
      <Button variant="ghost" onClick={resetFilters}>Reset filters</Button>
    </section>
    <section className="ministry-candidate-coverage" aria-label="Current candidate stages">
      <header><h2>Current stage coverage</h2><span>{positions.length} candidates · {positions.filter(event => event.point).length} located · {positions.filter(event => !event.point).length} awaiting location</span></header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{ALL_STAGES.map(stage => <button key={stage.id} aria-pressed={kind === stage.slug} onClick={() => setKind(kind === stage.slug ? 'all' : stage.slug as JourneyEventKind)}><span>{stage.title}</span><strong>{positions.filter(event => event.stageId === stage.id).length}</strong></button>)}</div>
      <details><summary>View candidate activity roster</summary><div className="grid gap-2 sm:grid-cols-2">{positions.map(event => { const candidate = candidates.find(item => item.id === event.candidateId)!; return <button key={event.id} className="ministry-coverage-row" onClick={() => { setSelectedId(candidate.id); setSelectedEventId(''); }}><CandidateAvatar candidate={candidate} className="h-10 w-10" /><span><strong>{candidate.first_name} {candidate.last_name}</strong><span>{event.title} · {event.status}</span><span>{event.point?.label || 'Awaiting ministry location'}</span></span></button>; })}</div></details>
    </section>
    <EditableGrid pageId="coc-map" items={[
      { id: 'stats', title: 'Journey signals', node: <div className="journey-control-metrics">{[
        { label: 'Visible candidates', value: filteredCandidates.length, icon: <Activity /> },
        { label: 'Recorded events', value: events.length, icon: <Clock3 /> },
        { label: 'Located evidence', value: events.length - missing, icon: <MapPin /> },
        { label: 'Awaiting location', value: missing, icon: <ShieldCheck /> },
      ].map(metric => <div key={metric.label}>{metric.icon}<strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div> },
      { id: 'network', title: 'Movement control', span: 8, node: <section className="journey-control-panel" data-tour="network-map">
        <header className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-xl font-semibold">{selected ? `${selected.first_name}'s evidence route` : 'Network location constellation'}</h2><p className="mt-1 text-xs text-muted-foreground">{effectiveId ? `${playedEvents.length} / ${events.length} events in view` : 'One node per recorded location · select to inspect'}</p></div><Badge variant="outline">{isLoading ? 'Loading' : 'Saved records'}</Badge></header>
        <JourneyControlMap events={mapEvents} selectedEvent={replayIndex === null ? inspected?.id : events[cursor]?.id} onSelect={selectEvent} running={playing} />
        {!mapEvents.some(event => event.point) && <p className="p-5 text-sm text-muted-foreground">No location evidence matches this view. Unlocated events remain in the ledger.</p>}
        <div className="journey-replay-controls">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold">Evidence replay</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Previous recorded event" disabled={!effectiveId || !events.length || cursor <= 0} onClick={() => step(-1)}><SkipBack className="h-4 w-4" /></Button><Button variant={playing ? 'default' : 'outline'} aria-pressed={playing} disabled={!effectiveId || !events.length || reduced} onClick={() => { if (!playing && cursor >= events.length - 1) setReplayIndex(0); setPlaying(value => !value); }}>{playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{playing ? 'Pause replay' : 'Play evidence'}</Button><Button size="icon" variant="outline" aria-label="Next recorded event" disabled={!effectiveId || !events.length || cursor >= events.length - 1} onClick={() => step(1)}><SkipForward className="h-4 w-4" /></Button><Button variant="ghost" disabled={replayIndex === null} onClick={() => { setPlaying(false); setReplayIndex(null); }}>All events</Button></div></div>
          <input type="range" aria-label="Recorded journey timeline" min="0" max={Math.max(0, events.length - 1)} value={Math.max(0, cursor)} disabled={!effectiveId || !events.length} onChange={event => { setPlaying(false); setReplayIndex(Number(event.target.value)); }} className="w-full accent-primary" />
          <p className="text-xs text-muted-foreground">{effectiveId ? timeLabel(events[cursor]?.at) : 'Select one candidate for chronological replay.'}{reduced ? ' Reduced motion: use manual steps.' : ''}</p>
        </div>
      </section> },
      { id: 'operations', title: 'Event inspector', span: 4, node: <aside className="journey-control-panel p-5" aria-label="Selected journey event"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Evidence inspector</p>{inspected ? <>
        <h2 className="mt-3 text-xl font-semibold">{inspected.title}</h2><Badge variant="outline" className={`mt-3 ${inspected.status === 'Failed' ? 'border-destructive text-destructive' : ''}`}>{inspected.status}</Badge>
        {(() => { const person = candidates.find(candidate => candidate.id === inspected.candidateId); return person && <div className="my-5 flex items-center gap-3"><CandidateAvatar candidate={person} className="h-12 w-12" /><div><strong className="block text-sm">{person.first_name} {person.last_name}</strong><span className="text-xs text-muted-foreground">{person.tracking_code}</span></div></div>; })()}
        <dl className="journey-inspector-facts"><div><dt>Recorded time</dt><dd>{timeLabel(inspected.at)}</dd></div><div><dt>Location</dt><dd>{inspected.point?.label ?? 'Awaiting ministry location'}</dd></div><div><dt>Precision</dt><dd>{inspected.precision === 'exact' ? 'Recorded coordinates' : inspected.precision === 'city' ? 'Approximate city, not facility GPS' : 'Awaiting ministry location'}</dd></div><div><dt>Source</dt><dd>{inspected.source}</dd></div></dl>
        <Button className="mt-5 w-full" onClick={() => openRecord(inspected)}>Open {inspected.kind === 'medical' ? 'medical record' : 'source record'}<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
      </> : <p className="mt-4 text-sm text-muted-foreground">Select a location or ledger event to inspect its source.</p>}</aside> },
      { id: 'ledger', title: 'Movement evidence ledger', span: 12, node: <section className="journey-control-panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Movement &amp; evidence ledger</h2><span className="text-xs text-muted-foreground">Newest first · {events.length} records</span></div><div className="journey-event-ledger mt-4">
        {orderedEvents.slice(safePage * 20, safePage * 20 + 20).map(event => {
          const person = candidates.find(candidate => candidate.id === event.candidateId)!;
          return <button key={event.id} type="button" aria-pressed={inspected?.id === event.id} className="journey-ledger-row" onClick={() => selectEvent(event)}><CandidateAvatar candidate={person} className="h-10 w-10 shrink-0" /><span><strong>{person.first_name} {person.last_name}</strong><small>{event.title}</small></span><span><strong>{event.point?.label ?? 'Awaiting ministry location'}</strong><small>{event.precision === 'exact' ? 'Recorded coordinates' : event.precision === 'city' ? 'City approximation' : 'Awaiting ministry location'}</small></span><span><strong className={event.status === 'Failed' ? 'text-destructive' : ''}>{event.status}</strong><small>{timeLabel(event.at)}</small></span><ArrowUpRight className="h-4 w-4 shrink-0 text-primary" /></button>;
        })}
        {!events.length && <p className="p-6 text-sm text-muted-foreground">{isLoading ? 'Loading journey evidence…' : 'No records match these filters.'}</p>}
      </div><div className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</Button><span className="text-sm">{safePage + 1} / {maxPage + 1}</span><Button variant="outline" disabled={safePage === maxPage} onClick={() => setPage(safePage + 1)}>Next</Button></div></section> },
      { id: 'centers', title: 'Center operations', span: 12, node: <section className="journey-control-panel p-5"><h2 className="text-xl font-semibold">Training center operations</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{facilities.map(facility => {
        const people = candidates.filter(candidate => candidate.coc_facility_id === facility.id);
        const trained = people.filter(candidate => data?.stages.some(stage => stage.candidate_id === candidate.id && stage.stage_id === ALL_STAGES.find(item => item.slug === 'training')?.id && ['Passed', 'Completed', 'Issued'].includes(stage.status))).length;
        return <button key={facility.id} type="button" className="agency-network-node text-left" aria-pressed={centerId === facility.id} onClick={() => { setCenterId(centerId === facility.id ? '' : facility.id); setSelectedId(''); }}><Building2 className="mb-3 h-6 w-6 text-primary" /><strong className="block">{facility.name}</strong><span className="mt-2 block text-sm text-muted-foreground">{people.length} assigned · {trained} trained</span><span className="mt-1 block text-xs text-muted-foreground">{facility.city || 'City pending'}</span></button>;
      })}</div>{!facilities.length && <p className="mt-4 text-sm text-muted-foreground">Awaiting ministry-linked centers. Historical candidate assignments remain preserved.</p>}</section> },
      { id: 'contracts', title: 'Deployment & return operations', span: 12, node: <details className="portal-flow-guide"><summary>Deployment, flights &amp; return operations <span>Open operational tools</span></summary><div className="p-4"><DestinationTracker />{selected && <EmploymentJourneyHistory candidate={selected} />}</div></details> },
    ]} />
    <Link to={userRole === 'local-agency' ? '/local-agency' : ['foreign-agency', 'foreign-agency-staff', 'agency'].includes(userRole ?? '') ? '/agency' : '/admin'} className="inline-flex items-center gap-2 text-sm text-primary">Return to dashboard<ArrowUpRight className="h-4 w-4" /></Link>
    <CandidateQuickView candidateId={quickId} onOpenChange={open => { if (!open) setQuickId(null); }} />
  </div>;
}
