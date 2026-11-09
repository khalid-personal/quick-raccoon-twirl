import { ALL_STAGES, type Candidate, type CandidateStage, type CocFacility, type Document, type JourneyLocation, type MedicalResult } from './types';
import { facilityCoordinates, findCity, resolveCandidateDestination } from './ethiopia';

export type JourneyEventKind = 'registration' | 'training' | 'medical' | 'deployment' | 'contract' | 'flight' | 'arrival' | 'return' | 'document';
export interface JourneyControlEvent {
  id: string;
  candidateId: string;
  kind: JourneyEventKind;
  title: string;
  status: string;
  at?: string;
  point?: { lat: number; lon: number; label: string };
  precision: 'exact' | 'city' | 'missing';
  source: string;
  stageId?: number;
  tab: 'timeline' | 'documents' | 'profile';
  current?: boolean;
}

const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? value : undefined;
export const journeyLocationPoint = (location?: JourneyLocation): Pick<JourneyControlEvent, 'point' | 'precision'> => {
  if (!location) return { precision: 'missing' };
  if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude!) <= 90 && Math.abs(location.longitude!) <= 180) {
    return { point: { lat: location.latitude!, lon: location.longitude!, label: `${location.name} · ${location.city}` }, precision: 'exact' };
  }
  const city = findCity(location.city);
  return city ? { point: { lat: city.lat, lon: city.lon, label: `${location.name} · ${city.name}` }, precision: 'city' } : { precision: 'missing' };
};

export function buildJourneyControlEvents(candidates: Candidate[], stages: CandidateStage[], medical: MedicalResult[], documents: Document[], facilities: CocFacility[]): JourneyControlEvent[] {
  const events: JourneyControlEvent[] = [];
  for (const candidate of candidates) {
    const home = journeyLocationPoint(candidate.home_city ? { name: 'Recorded origin', city: candidate.home_city } : undefined);
    events.push({ id: `${candidate.id}:origin`, candidateId: candidate.id, kind: 'registration', title: 'Registered profile', status: 'Recorded', at: timestamp(candidate.created_at), ...home, source: 'Candidate profile · origin is not a live position', stageId: 1, tab: 'profile' });
    const facility = facilities.find(item => item.id === candidate.coc_facility_id);
    const coords = facility && facilityCoordinates(facility);
    for (const stage of stages.filter(item => item.candidate_id === candidate.id)) {
      const definition = ALL_STAGES.find(item => item.id === stage.stage_id);
      if (!definition) continue;
      const medicalPlace = definition.slug === 'medical' ? medical.filter(item => item.candidate_id === candidate.id && item.location)
        .sort((a, b) => (b.recorded_at || b.exam_date || '').localeCompare(a.recorded_at || a.exam_date || ''))[0]?.location : undefined;
      const place = stage.location ? journeyLocationPoint(stage.location) : medicalPlace ? journeyLocationPoint(medicalPlace) : definition.slug === 'training' && coords && facility
        ? { point: { ...coords, label: facility.name }, precision: Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude) && Math.abs(facility.latitude!) <= 90 && Math.abs(facility.longitude!) <= 180 ? 'exact' as const : 'city' as const }
        : definition.slug === 'registration' ? home : { precision: 'missing' as const };
      const snapshots = stage.history?.length ? stage.history : [stage];
      snapshots.forEach((snapshot, index) => {
        if (snapshot.status === 'Pending' && !snapshot.date && !stage.history?.length) return;
        const snapshotPlace = snapshot.location ? journeyLocationPoint(snapshot.location) : index === snapshots.length - 1 ? place : { precision: 'missing' as const };
        events.push({ id: `${stage.id}:stage:${index}`, candidateId: candidate.id, kind: definition.slug as 'registration' | 'training' | 'medical' | 'deployment', title: `${definition.title} status${stage.history?.length && index < snapshots.length - 1 ? ' · historical' : ''}`, status: snapshot.status, at: timestamp(snapshot.date || snapshot.updated_at), ...snapshotPlace, source: 'Ministry stage record', stageId: stage.stage_id, tab: 'timeline' });
      });
    }
    for (const result of medical.filter(item => item.candidate_id === candidate.id)) {
      const snapshots = result.history?.length ? result.history : [result];
      snapshots.forEach((snapshot, index) => {
        if (snapshot.status === 'Pending' && !snapshot.exam_date && !snapshot.recorded_at && !snapshot.location) return;
        events.push({ id: `${result.id}:medical:${index}`, candidateId: candidate.id, kind: 'medical', title: `${result.exam_type} · ${snapshot.status}`, status: snapshot.status, at: timestamp(snapshot.exam_date || snapshot.recorded_at), ...journeyLocationPoint(snapshot.location), source: `Saved medical evidence${snapshot.recorded_at ? ` · entered ${snapshot.recorded_at}` : ''}`, stageId: 2, tab: 'timeline' });
      });
    }
    const candidateDocuments = documents.filter(item => item.candidate_id === candidate.id);
    for (const document of candidateDocuments) {
      const isContract = document.doc_kind === 'work_contract';
      const destination = isContract ? resolveCandidateDestination(undefined, document.extracted) : null;
      events.push({ id: `${document.id}:document`, candidateId: candidate.id, kind: isContract ? 'contract' : 'document', title: isContract ? 'Employment contract uploaded' : document.file_name, status: isContract ? 'Planned destination' : 'Evidence received', at: timestamp(document.uploaded_at), ...(destination ? { point: { lat: destination.lat, lon: destination.lon, label: `${destination.label} · planned contract destination` }, precision: 'city' as const } : { precision: 'missing' as const }), source: 'Original document record · not travelled movement', stageId: document.stage_id, tab: 'documents' });
    }
    const latestContract = candidateDocuments.filter(item => item.doc_kind === 'work_contract').sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
    const destination = resolveCandidateDestination(candidate.external_status, latestContract?.extracted);
    const destinationPoint = destination ? { point: { lat: destination.lat, lon: destination.lon, label: destination.label }, precision: 'city' as const } : { precision: 'missing' as const };
    if (candidate.flight?.departure_time) events.push({ id: `${candidate.id}:flight`, candidateId: candidate.id, kind: 'flight', title: `Flight ${candidate.flight.flight_number}`, status: 'Scheduled · not departed', at: timestamp(candidate.flight.departure_time), precision: 'missing', source: `${candidate.flight.departure_airport} → ${candidate.flight.arrival_airport} · saved booking`, stageId: 4, tab: 'timeline' });
    if (candidate.arrival?.arrived_at) events.push({ id: `${candidate.id}:arrival`, candidateId: candidate.id, kind: 'arrival', title: 'Arrival confirmed', status: `Confirmed by ${candidate.arrival.confirmed_by}`, at: timestamp(candidate.arrival.arrived_at), ...destinationPoint, source: 'Saved arrival confirmation · destination-city approximation', stageId: 4, tab: 'timeline' });
    if (candidate.actual_return_date) events.push({ id: `${candidate.id}:return`, candidateId: candidate.id, kind: 'return', title: 'Return recorded', status: 'Returned', at: timestamp(candidate.actual_return_date), ...home, source: 'Saved return date · home city, not an arrival coordinate', tab: 'profile' });
    candidate.employment_history?.forEach((journey, index) => {
      const archived = resolveCandidateDestination({ destination_city: journey.destination_city, destination_country: journey.destination_country }, undefined);
      if (journey.departed_at) events.push({ id: `${candidate.id}:history:${index}:depart`, candidateId: candidate.id, kind: 'deployment', title: 'Archived employment departure', status: 'Recorded history', at: timestamp(journey.departed_at), ...(archived ? { point: { lat: archived.lat, lon: archived.lon, label: `${archived.label} · historical destination` }, precision: 'city' as const } : { precision: 'missing' as const }), source: 'Employment history · destination is not departure location', tab: 'profile' });
      if (journey.returned_at) events.push({ id: `${candidate.id}:history:${index}:return`, candidateId: candidate.id, kind: 'return', title: 'Archived return', status: 'Recorded history', at: timestamp(journey.returned_at), ...journeyLocationPoint({ name: 'Historical home', city: journey.home_city }), source: 'Employment history', tab: 'profile' });
    });
  }
  return events.sort((a, b) => (a.at ? Date.parse(a.at) : -Infinity) - (b.at ? Date.parse(b.at) : -Infinity) || a.id.localeCompare(b.id));
}

export function currentJourneyEvents(candidates: Candidate[], stages: CandidateStage[], medical: MedicalResult[], documents: Document[], facilities: CocFacility[]): JourneyControlEvent[] {
  const stagesByCandidate = new Map<string, Map<number, CandidateStage>>();
  const latestMedical = new Map<string, MedicalResult>();
  const latestContracts = new Map<string, Document>();
  const centers = new Map(facilities.map(facility => [facility.id, facility]));
  for (const stage of stages) {
    const records = stagesByCandidate.get(stage.candidate_id) ?? new Map<number, CandidateStage>();
    records.set(stage.stage_id, stage);
    stagesByCandidate.set(stage.candidate_id, records);
  }
  for (const result of medical) {
    const previous = latestMedical.get(result.candidate_id);
    if (result.location && (!previous || (result.recorded_at || result.exam_date || '') >= (previous.recorded_at || previous.exam_date || ''))) latestMedical.set(result.candidate_id, result);
  }
  for (const document of documents) {
    if (document.doc_kind === 'work_contract' && document.uploaded_at >= (latestContracts.get(document.candidate_id)?.uploaded_at ?? '')) latestContracts.set(document.candidate_id, document);
  }
  return candidates.map(candidate => {
    const ordered = ALL_STAGES.map(definition => stagesByCandidate.get(candidate.id)?.get(definition.id));
    let currentIndex = 0;
    ordered.forEach((record, index) => {
      if (record && record.status !== 'Pending') currentIndex = ['Passed', 'Issued', 'Completed'].includes(record.status) ? Math.min(index + 1, ALL_STAGES.length - 1) : index;
    });
    const stage = ordered[currentIndex];
    const definition = ALL_STAGES[currentIndex];
    const center = centers.get(candidate.coc_facility_id ?? '');
    const coords = center && facilityCoordinates(center);
    const place = stage?.location ?? (definition.slug === 'medical' ? latestMedical.get(candidate.id)?.location : undefined);
    const explicit = place ? journeyLocationPoint(place) : stage && definition.slug === 'training' && center && coords
      ? journeyLocationPoint({ name: center.name, city: center.city ?? '', latitude: center.latitude, longitude: center.longitude })
      : stage && definition.slug === 'registration' && candidate.home_city ? journeyLocationPoint({ name: 'Registered origin', city: candidate.home_city }) : { precision: 'missing' as const };
    if (definition.id === 4 && candidate.arrival?.arrived_at) {
      const destination = resolveCandidateDestination(candidate.external_status, latestContracts.get(candidate.id)?.extracted);
      return {
        id: `${candidate.id}:current`, candidateId: candidate.id, kind: 'arrival' as const,
        title: 'Arrival · current ministry position', status: 'Arrival confirmed', at: timestamp(candidate.arrival.arrived_at),
        ...(destination ? { point: { lat: destination.lat, lon: destination.lon, label: `${destination.label} · confirmed arrival city` }, precision: 'city' as const } : { precision: 'missing' as const }),
        source: 'Ministry arrival record · destination-city approximation', stageId: 4, tab: 'timeline' as const, current: true,
      };
    }
    return {
      id: `${candidate.id}:current`, candidateId: candidate.id, kind: definition.slug as JourneyEventKind,
      title: `${definition.title} · current stage`, status: stage?.status ?? 'Awaiting ministry update',
      at: timestamp(stage?.updated_at), ...explicit, source: 'Ministry stage position',
      stageId: definition.id, tab: 'timeline', current: true,
    };
  });
}
