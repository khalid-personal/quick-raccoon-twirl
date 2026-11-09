import { expect, it } from 'vitest';
import { buildJourneyControlEvents, currentJourneyEvents, journeyLocationPoint } from '../journey-control';
import type { Candidate, CandidateStage, Document, MedicalResult } from '../types';

const candidate: Candidate = { id: 'person-1', first_name: 'Hana', last_name: 'Tadesse', dob: '1998-01-01', passport_number: 'SYN-1', tracking_code: 'TRK-1', country_of_origin: 'Ethiopia', marital_status: 'Single', email: 'hana@example.test', home_city: 'Adama', created_at: '2026-01-01', updated_at: '2026-01-01', payment_status: 'unpaid' };
it('distinguishes exact facility coordinates, approximate cities and missing medical locations', () => {
  expect(journeyLocationPoint({ name: 'Assessment clinic', city: 'Adama', latitude: 8.54, longitude: 39.27 })).toMatchObject({ precision: 'exact', point: { lat: 8.54, lon: 39.27 } });
  expect(journeyLocationPoint({ name: 'Assessment clinic', city: 'Adama' }).precision).toBe('city');
  expect(journeyLocationPoint({ name: 'Unknown clinic', city: 'Unmapped city' })).toEqual({ precision: 'missing' });
  expect(journeyLocationPoint({ name: 'Unknown clinic', city: 'Unmapped city', latitude: 200, longitude: 400 })).toEqual({ precision: 'missing' });
});
it('retains medical history chronologically without assigning an unlocated result to the home or training center', () => {
  const medical: MedicalResult[] = [{ id: 'exam-1', candidate_id: candidate.id, exam_type: 'HIV', status: 'Passed', history: [
    { status: 'Pending', exam_date: '2026-01-03', location: { name: 'First clinic', city: 'Adama' } },
    { status: 'Passed', exam_date: '2026-01-07', location: { name: 'Second clinic', city: 'Hawassa' } },
  ] }, { id: 'exam-2', candidate_id: candidate.id, exam_type: 'Final Agency Medical', status: 'Passed', exam_date: '2026-01-10' },
  { id: 'outside-scope', candidate_id: 'other-person', exam_type: 'HIV', status: 'Failed', exam_date: '2026-01-01' }];
  const events = buildJourneyControlEvents([candidate], [], medical, [], []);
  const exams = events.filter(event => event.kind === 'medical');
  expect(exams).toHaveLength(3);
  expect(exams.map(event => event.at)).toEqual(['2026-01-03', '2026-01-07', '2026-01-10']);
  expect(exams[0].point?.label).toContain('First clinic');
  expect(exams[1].point?.label).toContain('Second clinic');
  expect(exams[2].point).toBeUndefined();
  expect(exams[2].stageId).toBe(2);
  expect(events.some(event => event.candidateId === 'other-person')).toBe(false);
});
it('keeps stage changes, planned bookings, original contracts, arrival confirmations and historical returns distinct', () => {
  const person = { ...candidate, flight: { flight_number: 'ET123', departure_airport: 'ADD', arrival_airport: 'JED', departure_time: '2026-02-01T12:00:00Z' }, arrival: { arrived_at: '2026-02-02', confirmed_by: 'candidate' as const }, employment_history: [{ home_city: 'Adama', coc_facility_id: 'old-center', destination_city: 'Jeddah', destination_country: 'Saudi Arabia', departed_at: '2025-01-01', returned_at: '2025-12-01' }] };
  const stages: CandidateStage[] = [{ id: 'training-1', candidate_id: person.id, stage_id: 3, status: 'Passed', updated_at: '2026-01-08', history: [{ status: 'In Progress', updated_at: '2026-01-04' }, { status: 'Passed', date: '2026-01-08', updated_at: '2026-01-08' }] }];
  const documents: Document[] = [{ id: 'contract-1', candidate_id: person.id, stage_id: 4, file_name: 'contract.pdf', file_type: 'application/pdf', storage_key: 'contract-1', uploaded_at: '2026-01-20', doc_kind: 'work_contract', extracted: { destination_city: 'Jeddah', destination_country: 'Saudi Arabia' } }];
  const events = buildJourneyControlEvents([person], stages, [], documents, []);
  expect(events.filter(event => event.kind === 'training')).toHaveLength(2);
  expect(events.find(event => event.kind === 'flight')).toMatchObject({ status: 'Scheduled · not departed', precision: 'missing' });
  expect(events.find(event => event.kind === 'contract')).toMatchObject({ status: 'Planned destination', precision: 'city', tab: 'documents' });
  expect(events.find(event => event.kind === 'arrival')?.status).toBe('Confirmed by candidate');
  expect(events[0].title).toBe('Archived employment departure');
  expect(events.some(event => event.title === 'Archived return')).toBe(true);
});
const stage = (id: number, status: CandidateStage['status']): CandidateStage => ({ id: `stage-${id}`, candidate_id: candidate.id, stage_id: id, status, updated_at: '2026-01-08' });
it.each([1, 3, 2, 4])('accounts for the current source stage %s in canonical journey order', stageId => {
  const order = [1, 3, 2, 4];
  const records = order.map((id, index) => stage(id, index < order.indexOf(stageId) ? 'Passed' : 'Pending'));
  expect(currentJourneyEvents([candidate], records, [], [], [])).toMatchObject([{ candidateId: candidate.id, stageId, current: true }]);
});
it('accounts for every candidate with absent source records without inventing a home-city position', () => {
  const people = [candidate, { ...candidate, id: 'person-2' }];
  const events = currentJourneyEvents(people, [], [], [], []);
  expect(events).toHaveLength(people.length);
  expect(new Set(events.map(event => event.candidateId)).size).toBe(people.length);
  expect(events.every(event => !event.point && event.status === 'Awaiting ministry update')).toBe(true);
});
it('uses later ministry progression even when previous source stages have not arrived', () => {
  const events = currentJourneyEvents([candidate], [{ ...stage(2, 'In Progress'), location: { name: 'Source clinic', city: 'Adama' } }], [], [], []);
  expect(events[0]).toMatchObject({ stageId: 2, status: 'In Progress', point: { label: 'Source clinic · Adama' } });
});
it('uses medical location evidence on a pending source stage without inventing deployment positions', () => {
  const exams: MedicalResult[] = [{ id: 'exam', candidate_id: candidate.id, exam_type: 'HIV', status: 'Passed', location: { name: 'Clinic', city: 'Hawassa' } }];
  expect(currentJourneyEvents([candidate], [stage(3, 'Passed'), stage(2, 'Pending')], exams, [], [])[0].point?.label).toContain('Clinic');
  expect(currentJourneyEvents([candidate], [stage(2, 'Passed'), stage(4, 'In Progress')], exams, [], [])[0].point).toBeUndefined();
});
it('keeps historical and current stage locations distinct and prioritizes explicit source locations', () => {
  const record = { ...stage(2, 'In Progress'), location: { name: 'Current clinic', city: 'Adama' }, history: [
    { status: 'Pending' as const, date: '2026-01-01', updated_at: '2026-01-01' }, { status: 'In Progress' as const, date: '2026-01-08', updated_at: '2026-01-08', location: { name: 'Current clinic', city: 'Adama' } },
  ] };
  const events = buildJourneyControlEvents([candidate], [record], [], [], []).filter(event => event.kind === 'medical');
  expect(events[0].point).toBeUndefined();
  expect(currentJourneyEvents([candidate], [record], [], [], [])[0].point?.label).toContain('Current clinic');
});
it('only shows arrival-city positions after a ministry arrival record, never from a booked flight', () => {
  const person = { ...candidate, external_status: { destination_city: 'Jeddah', destination_country: 'Saudi Arabia' }, flight: { flight_number: 'ET1', departure_airport: 'ADD', arrival_airport: 'JED', departure_time: '2026-02-01' } };
  expect(currentJourneyEvents([person], [stage(4, 'Completed')], [], [], [])[0].point).toBeUndefined();
  const events = currentJourneyEvents([{ ...person, arrival: { arrived_at: '2026-02-02', confirmed_by: 'admin' } }], [stage(4, 'Completed')], [], [], []);
  expect(events[0]).toMatchObject({ kind: 'arrival', precision: 'city', status: 'Arrival confirmed' });
});
