import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, GraduationCap, Mail, MapPin, Navigation, Pause, Phone, Play, SkipBack, SkipForward, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/page/PageHeader';
import StatCards from '@/components/page/StatCards';
import EthiopiaMap, { MapLink, MapPoint } from '@/components/EthiopiaMap';
import { getCandidates, getCandidateStages, getCocFacilities, getDocuments } from '@/lib/data-store';
import DestinationTracker from '@/components/DestinationTracker';
import RouteMap from '@/components/RouteMap';
import EmploymentJourneyHistory from '@/components/EmploymentJourneyHistory';
import CandidateQuickView from '@/components/CandidateQuickView';
import EditableGrid from '@/components/EditableGrid';
import { useAuth } from '@/lib/auth-context';
import { facilityCoordinates, facilityMapsUrl, findCity, resolveCandidateDestination } from '@/lib/ethiopia';
import { ETHIOPIAN_REGIONS, REGION_NOT_SET } from '@/lib/ethiopia-regions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_STAGES } from '@/lib/types';
import CandidateAvatar from '@/components/CandidateAvatar';
import { useCandidateWorkspace } from '@/components/CandidateQuickViewProvider';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { usePageMemory } from '@/hooks/use-page-memory';
import { navigationItemClass } from '@/components/ui/navigation-rail';
import {
  clampTrainingMapRouteIndex,
  filterTrainingMapCandidates,
  nextTrainingMapRouteIndex,
  previousTrainingMapRouteIndex,
  sortTrainingMapCandidates,
  trainingMapOriginColor,
  trainingMapRegionColor,
  trainingMapRegions,
  TRAINING_MAP_ROUTE_INTERVAL_MS,
  type TrainingMapJourneyFilter,
  visibleTrainingMapCandidates,
} from '@/lib/training-map';

const CAPITAL = { lat: 9.03, lon: 38.74, label: 'Addis Ababa (capital)' };

const AdminTrainingMap: React.FC = () => {
  const { userRole, user, viewAs, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const openCandidateWorkspace = useCandidateWorkspace();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isLocalAgency = userRole === 'local-agency';
  const isForeignAgency = userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'agency';
  const isAssignedStaff = userRole === 'staff';
  const staffId = viewAs?.userId ?? user?.id;
  const [rememberedTarget, setTarget] = usePageMemory('training-map:target', 'capital');
  const [rememberedSelectedId, setSelectedId] = usePageMemory('training-map:selected-candidate', '');
  const [rememberedView, setView] = usePageMemory<'intake' | 'contracts'>('training-map:view', 'intake');
  const [rememberedCenterId, setCenterId] = usePageMemory('training-map:center', '');
  const [rememberedRegionFilter, setRegionFilter] = usePageMemory('training-map:region', 'all');
  const [rememberedJourneyFilter, setJourneyFilter] = usePageMemory<TrainingMapJourneyFilter>('training-map:journey', 'all');
  const [rememberedRouteIndex, setRouteIndex] = usePageMemory('training-map:route-index', 0);
  const [quickId, setQuickId] = React.useState<string | null>(null);
  const [isRoutePlaying, setIsRoutePlaying] = React.useState(true);
  const { data } = useQuery({
    queryKey: ['trainingMap'],
    queryFn: async () => ({ facilities: getCocFacilities(), candidates: getCandidates(), documents: getDocuments(), stages: getCandidateStages() }),
    refetchInterval: 15000,
  });
  const facilities = data?.facilities ?? [];
  const target = !data || rememberedTarget === 'capital' || rememberedTarget === 'none'
    || facilities.some(facility => facility.id === rememberedTarget) ? rememberedTarget : 'capital';
  const view = rememberedView === 'contracts' ? 'contracts' : 'intake';
  const centerId = !data || !rememberedCenterId || facilities.some(facility => facility.id === rememberedCenterId)
    ? rememberedCenterId : '';
  const regionFilter = !data || rememberedRegionFilter === 'all' || rememberedRegionFilter === REGION_NOT_SET
    || (ETHIOPIAN_REGIONS as readonly string[]).includes(rememberedRegionFilter) ? rememberedRegionFilter : 'all';
  const journeyFilter: TrainingMapJourneyFilter = ['all', 'returnees', 'eligible', 'reapplying', 'redeployed'].includes(rememberedJourneyFilter)
    ? rememberedJourneyFilter : 'all';
  const candidates = React.useMemo(() => (data?.candidates ?? []).filter(candidate => isForeignAgency
    ? candidate.foreign_agency_id === userForeignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)
    : isLocalAgency
      ? candidate.local_agency_id === userLocalAgencyId
      : !isAssignedStaff || candidate.assigned_staff_id === staffId),
  [data?.candidates, isForeignAgency, userForeignAgencyId, isLocalAgency, userLocalAgencyId, isAssignedStaff, staffId]);
  const candidateIds = React.useMemo(() => new Set(candidates.map(candidate => candidate.id)), [candidates]);
  const documents = React.useMemo(() => (data?.documents ?? []).filter(document => candidateIds.has(document.candidate_id)), [data?.documents, candidateIds]);
  const stages = React.useMemo(() => (data?.stages ?? []).filter(stage => candidateIds.has(stage.candidate_id)), [data?.stages, candidateIds]);
  const regionCandidates = filterTrainingMapCandidates(candidates, { region: regionFilter, journey: journeyFilter });
  const contractIds = React.useMemo(() => new Set([
    ...documents.filter(d => d.doc_kind === 'work_contract').map(d => d.candidate_id),
    ...candidates.filter(c => c.external_status?.work_contract).map(c => c.id),
  ]), [documents, candidates]);

  const points: MapPoint[] = [];
  for (const f of facilities) {
    const c = facilityCoordinates(f);
    if (c) points.push({ ...c, label: f.name });
  }

  const withContract = regionCandidates.filter(c => contractIds.has(c.id) || c.employment_history?.length);
  const selectedId = withContract.some(candidate => candidate.id === rememberedSelectedId) ? rememberedSelectedId : '';
  const targetFacility = facilities.find(f => f.id === target);
  const targetPoint = target === 'capital' ? CAPITAL : target === 'none' ? null : (() => {
    const c = targetFacility && facilityCoordinates(targetFacility);
    return c && targetFacility ? { ...c, label: targetFacility.name } : null;
  })();
  const routeCandidates = sortTrainingMapCandidates(view === 'intake'
    ? regionCandidates.filter(candidate => !centerId || candidate.coc_facility_id === centerId)
    : withContract.filter(candidate => contractIds.has(candidate.id)));
  const allLinks: MapLink[] = [];
  let unmappableCount = 0;
  for (const candidate of routeCandidates) {
    const home = findCity(candidate.home_city);
    const facility = facilities.find(item => item.id === candidate.coc_facility_id);
    const facilityPoint = facility && facilityCoordinates(facility);
    const name = `${candidate.first_name} ${candidate.last_name}`;
    if (!home) {
      unmappableCount += 1;
      continue;
    }
    if (view === 'intake') {
      if (!facility || !facilityPoint) {
        unmappableCount += 1;
        continue;
      }
      allLinks.push({
        id: candidate.id,
        color: trainingMapOriginColor(candidate),
        from: { lat: home.lat, lon: home.lon, label: home.name },
        to: { ...facilityPoint, label: facility.name },
        label: `${name}: ${home.name} → ${facility.name}`,
      });
    } else if (target === 'none') {
      if (!facility || !facilityPoint) {
        unmappableCount += 1;
        continue;
      }
      allLinks.push({
        id: candidate.id,
        color: trainingMapOriginColor(candidate),
        from: { ...facilityPoint, label: facility.name },
        to: { lat: home.lat, lon: home.lon, label: home.name },
        label: `${name}: ${facility.name} → ${home.name}`,
      });
    } else if (targetPoint) {
      allLinks.push({
        id: candidate.id,
        color: trainingMapOriginColor(candidate),
        from: { lat: home.lat, lon: home.lon, label: home.name },
        to: targetPoint,
        label: `${name}: ${home.name} → ${targetPoint.label}`,
      });
    } else {
      unmappableCount += 1;
    }
  }
  const hasSpecificFilter = regionFilter !== 'all' || journeyFilter !== 'all' || !!centerId;
  const routableIds = new Set(allLinks.map(link => link.id));
  const routableCandidates = routeCandidates.filter(candidate => routableIds.has(candidate.id));
  const routeIndex = clampTrainingMapRouteIndex(rememberedRouteIndex, routableCandidates.length);
  const visibleCandidates = visibleTrainingMapCandidates(routableCandidates, routeIndex, hasSpecificFilter);
  const visibleCandidateIds = new Set(visibleCandidates.map(candidate => candidate.id));
  const links = allLinks.filter(link => visibleCandidateIds.has(link.id));
  const visibleRouteStart = hasSpecificFilter && routableCandidates.length
    ? Math.floor((routeIndex % routableCandidates.length) / 8) * 8 + 1
    : routableCandidates.length ? (routeIndex % routableCandidates.length) + 1 : 0;
  const visibleRouteEnd = hasSpecificFilter ? Math.min(visibleRouteStart + links.length - 1, routableCandidates.length) : visibleRouteStart;
  const routeRegions = trainingMapRegions(routableCandidates);
  const trainingStageId = ALL_STAGES.find(stage => stage.slug === 'training')?.id;
  const trainingStatus = new Map(stages.filter(st => st.stage_id === trainingStageId).map(st => [st.candidate_id, st.status]));
  const centerStats = facilities.map(f => {
    const roster = candidates.filter(c => c.coc_facility_id === f.id);
    const done = roster.filter(c => ['Passed', 'Completed', 'Issued'].includes(trainingStatus.get(c.id) ?? '')).length;
    const active = roster.filter(c => trainingStatus.get(c.id) === 'In Progress').length;
    return { facility: f, total: roster.length, done, active, waiting: roster.length - done - active };
  });
  const unassigned = candidates.filter(c => !facilities.some(f => f.id === c.coc_facility_id)).length;
  const inTraining = centerStats.reduce((sum, c) => sum + c.active, 0);
  const trained = centerStats.reduce((sum, c) => sum + c.done, 0);

  React.useEffect(() => {
    if (!data) return;
    if (rememberedTarget !== target) setTarget(target);
    if (rememberedView !== view) setView(view);
    if (rememberedCenterId !== centerId) setCenterId(centerId);
    if (rememberedRegionFilter !== regionFilter) setRegionFilter(regionFilter);
    if (rememberedJourneyFilter !== journeyFilter) setJourneyFilter(journeyFilter);
    if (rememberedSelectedId && !candidates.some(candidate => candidate.id === rememberedSelectedId && (contractIds.has(candidate.id) || candidate.employment_history?.length))) {
      setSelectedId('');
    }
    if (rememberedRouteIndex !== routeIndex) setRouteIndex(routeIndex);
  }, [data, target, rememberedTarget, setTarget, view, rememberedView, setView, centerId, rememberedCenterId, setCenterId, regionFilter, rememberedRegionFilter, setRegionFilter, journeyFilter, rememberedJourneyFilter, setJourneyFilter, rememberedSelectedId, setSelectedId, candidates, contractIds, rememberedRouteIndex, routeIndex, setRouteIndex]);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setIsRoutePlaying(false);
      return;
    }
    if (!isRoutePlaying || hasSpecificFilter || routableCandidates.length < 2) return;
    const timer = window.setInterval(() => {
      setRouteIndex(current => nextTrainingMapRouteIndex(current, routableCandidates.length, false));
    }, TRAINING_MAP_ROUTE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasSpecificFilter, isRoutePlaying, prefersReducedMotion, routableCandidates.length, setRouteIndex]);

  const selected = withContract.find(c => c.id === selectedId) ?? withContract[0];
  const selectedDoc = selected && documents.filter(d => d.candidate_id === selected.id && d.doc_kind === 'work_contract').sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at))[0];
  const destination = selected && resolveCandidateDestination(selected.external_status, selectedDoc?.extracted);
  const selectedFacility = selected && facilities.find(f => f.id === selected.coc_facility_id);
  const originCoords = selectedFacility ? facilityCoordinates(selectedFacility) : null;
  const origin: MapPoint = originCoords && selectedFacility ? { ...originCoords, label: selectedFacility.name } : CAPITAL;
  const homeCoords = selected ? findCity(selected.home_city) : undefined;
  const home: MapPoint | undefined = homeCoords && selected ? { lat: homeCoords.lat, lon: homeCoords.lon, label: selected.home_city ?? homeCoords.name } : undefined;
  const currentPhase = (candidateId: string) => {
    const records = stages.filter(stage => stage.candidate_id === candidateId).sort((a, b) => a.stage_id - b.stage_id);
    const current = records.find(stage => !['Passed', 'Issued', 'Completed'].includes(stage.status));
    return current ? `${ALL_STAGES.find(stage => stage.id === current.stage_id)?.title ?? 'Current stage'} · ${current.status}` : 'Journey complete';
  };
  const openRouteCandidate = (candidateId: string) => {
    if (openCandidateWorkspace) openCandidateWorkspace(candidateId);
    else setQuickId(candidateId);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="CoC Training Centers" description="Where candidates train, who is at each center, and how they travel there and on to their destination." />
      <EditableGrid pageId="coc-map" items={[
      { id: 'stats', title: 'Center stats', node: <StatCards items={[
        { label: 'CoC centers', value: facilities.length, icon: <Building2 className="h-4 w-4" /> },
        { label: 'In training', value: inTraining, icon: <GraduationCap className="h-4 w-4" /> },
        { label: 'Training complete', value: trained, icon: <GraduationCap className="h-4 w-4" /> },
        { label: 'No center assigned', value: unassigned, icon: <UserX className="h-4 w-4" /> },
      ]} /> },
      { id: 'network', title: 'Network map', span: 8, node: (
        <Card data-tour="network-map">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Network map</CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={regionFilter} onValueChange={value => { setRegionFilter(value); setRouteIndex(0); }}>
                <SelectTrigger aria-label="Filter by Ethiopian region" className="w-48"><SelectValue placeholder="All regions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {ETHIOPIAN_REGIONS.map(region => <SelectItem key={region} value={region}>{region}</SelectItem>)}
                  <SelectItem value={REGION_NOT_SET}>{REGION_NOT_SET}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={journeyFilter} onValueChange={value => { setJourneyFilter(value as TrainingMapJourneyFilter); setRouteIndex(0); }}>
                <SelectTrigger aria-label="Filter by return journey" className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All journeys</SelectItem>
                  <SelectItem value="returnees">All returnees</SelectItem>
                  <SelectItem value="eligible">Eligible to reapply</SelectItem>
                  <SelectItem value="reapplying">Reapplying</SelectItem>
                  <SelectItem value="redeployed">Redeployed</SelectItem>
                </SelectContent>
              </Select>
              <div role="group" aria-label="Journey map view" className="navigation-rail">
                <button type="button" className={navigationItemClass(view === 'intake')} aria-pressed={view === 'intake'} onClick={() => { setView('intake'); setRouteIndex(0); }}><GraduationCap aria-hidden="true" />Intake to centers</button>
                <button type="button" className={navigationItemClass(view === 'contracts')} aria-pressed={view === 'contracts'} onClick={() => { setView('contracts'); setRouteIndex(0); }}><Navigation aria-hidden="true" />Contract routes</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === 'contracts' && (
              <div className="flex items-center gap-2 mb-3 text-sm">
                <label htmlFor="route-target">Route candidates' home cities to</label>
                <select id="route-target" className="h-9 rounded-md border bg-background px-2" value={target} onChange={e => { setTarget(e.target.value); setRouteIndex(0); }}>
                  <option value="capital">Addis Ababa (capital)</option>
                  {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  <option value="none">Training facility → home city</option>
                </select>
              </div>
            )}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">
                {hasSpecificFilter
                  ? `Showing routes ${visibleRouteStart}–${visibleRouteEnd} of ${routableCandidates.length} · alphabetical A–Z`
                  : routableCandidates.length
                    ? `Candidate route ${visibleRouteStart} of ${routableCandidates.length} · alphabetical A–Z`
                    : 'No mappable candidate routes in this view'}
              </p>
              <div className="flex items-center gap-2">
                {!hasSpecificFilter && prefersReducedMotion && <span className="text-xs text-muted-foreground">Animation off for reduced motion</span>}
                {!hasSpecificFilter && (
                  <Button size="sm" variant="outline" aria-label={isRoutePlaying ? 'Pause route animation' : 'Resume route animation'} disabled={prefersReducedMotion || routableCandidates.length < 2} onClick={() => setIsRoutePlaying(playing => !playing)}>
                    {isRoutePlaying ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                    {isRoutePlaying ? 'Pause' : 'Play'}
                  </Button>
                )}
                {hasSpecificFilter && (
                  <Button size="sm" variant="outline" aria-label="Previous route group" disabled={routableCandidates.length <= 8} onClick={() => setRouteIndex(index => previousTrainingMapRouteIndex(index, routableCandidates.length, true))}>
                    <SkipBack className="mr-1 h-4 w-4" />Previous
                  </Button>
                )}
                <Button size="sm" variant="outline" aria-label={hasSpecificFilter ? 'Next route group' : 'Next candidate route'} disabled={routableCandidates.length < 2} onClick={() => setRouteIndex(index => nextTrainingMapRouteIndex(index, routableCandidates.length, hasSpecificFilter))}>
                  <SkipForward className="mr-1 h-4 w-4" />{hasSpecificFilter ? 'Next group' : 'Next'}
                </Button>
              </div>
            </div>
            <EthiopiaMap facilities={points} links={links} animateRoutes={!hasSpecificFilter && isRoutePlaying && !prefersReducedMotion} onLinkClick={openRouteCandidate} />
            {routeRegions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Route color legend">
                <span className="text-xs font-medium text-muted-foreground">Candidate origin region</span>
                {routeRegions.map(region => (
                  <span key={region} className="inline-flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: trainingMapRegionColor(region) }} aria-hidden="true" />
                    {region}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {view === 'intake'
                ? 'Each trail follows one candidate from their home city to their assigned CoC center.'
                : 'Contract trails follow each candidate from their home city to the selected destination.'}
              {unmappableCount > 0 && ` ${unmappableCount} candidate${unmappableCount === 1 ? ' is' : 's are'} not shown because required home-city or center/destination map data is missing.`}
            </p>
            {links[0] && !hasSpecificFilter && <p className="mt-1 text-sm font-medium">{links[0].label}</p>}
          </CardContent>
        </Card>
      ) },
      { id: 'centers', title: 'Centers', span: 4, node: (
        <Card>
          <CardHeader><CardTitle>Centers</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {facilities.length === 0 && <p className="text-sm text-muted-foreground">No CoC centers configured.</p>}
            {centerStats.map(({ facility: f, total, done, active, waiting }) => {
              const url = facilityMapsUrl(f);
              const chosen = centerId === f.id;
              return (
                <div key={f.id} className={`rounded-lg border p-3 text-sm transition-colors ${chosen ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                  <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => { setCenterId(chosen ? '' : f.id); setView('intake'); setRouteIndex(0); }}>
                    <span>
                      <span className="block font-medium">{f.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{f.address || f.city || 'No location set'}</span>
                    </span>
                    <Badge variant="secondary">{total}</Badge>
                  </button>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>{active} training</span><span>{done} done</span><span>{waiting} waiting</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {url
                      ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary"><Navigation className="h-3 w-3" />GPS <ExternalLink className="h-3 w-3" /></a>
                      : <Link to="/admin/settings" className="text-amber-600 dark:text-amber-400">Add location in Settings</Link>}
                    {f.phone_number && <a href={`tel:${f.phone_number}`} className="inline-flex items-center gap-1 text-primary"><Phone className="h-3 w-3" />Call</a>}
                    {f.contact_email && <a href={`mailto:${f.contact_email}`} className="inline-flex items-center gap-1 text-primary"><Mail className="h-3 w-3" />Email</a>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) },
      { id: 'journey', title: 'Journey abroad', span: 8, node: (
        <Card>
          <CardHeader><CardTitle>Journey abroad</CardTitle><p className="text-sm text-muted-foreground">Home → CoC center → destination</p></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <label htmlFor="route-candidate">Candidate journey</label>
              <Select value={selected?.id ?? ''} onValueChange={setSelectedId}>
                <SelectTrigger id="route-candidate"><SelectValue placeholder="Choose candidate" /></SelectTrigger>
                <SelectContent>
                  {withContract.length === 0 && <SelectItem value="none">None yet</SelectItem>}
                  {withContract.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2"><CandidateAvatar candidate={c} className="h-8 w-8" /><span className="flex flex-col"><span>{c.first_name} {c.last_name}</span><span className="text-xs text-muted-foreground">{currentPhase(c.id)}</span></span></span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && <div className="rounded-md bg-muted/50 px-3 py-2"><button type="button" className="font-medium hover:text-primary hover:underline" onClick={() => openRouteCandidate(selected.id)}>{selected.first_name} {selected.last_name}</button><p className="text-xs text-muted-foreground">Current phase · {currentPhase(selected.id)}</p></div>}
              {selected && !destination && <p className="text-amber-600">Add a destination city or country in the contract details to draw the route.</p>}
              {destination && home && <p className="text-xs font-medium text-muted-foreground">{home.label} → {selectedFacility?.name ?? 'CoC center not assigned'} → {destination.label}</p>}
            </div>
            <div>
              {destination && home
                ? <RouteMap origin={home} waypoints={selectedFacility && originCoords ? [origin] : []} destination={destination} heightClassName="h-[340px]" />
                : <div className="grid h-36 place-items-center rounded-md border text-center text-sm text-muted-foreground">{selected ? 'Home city or destination details are missing.' : 'Select a candidate with a work contract.'}</div>}
            </div>
            {selected?.employment_history?.length ? <div className="border-t pt-4"><EmploymentJourneyHistory candidate={selected} /></div> : null}
          </CardContent>
        </Card>
      ) },
      { id: 'tracker', title: 'Where candidates are going', node: <DestinationTracker /> },
      ]} />
      <CandidateQuickView candidateId={quickId} onOpenChange={open => !open && setQuickId(null)} />
    </div>
  );
};

export default AdminTrainingMap;
