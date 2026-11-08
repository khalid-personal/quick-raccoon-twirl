import { describe, expect, it } from 'vitest';
import { generateDemoDataset, DEMO_CANDIDATE_COUNT } from '../demo-dataset';
import { analyzeIntegrity, countBySeverity, riskScore } from '../integrity';
import { ALL_STAGES, type CandidateStage } from '../types';
import { buildTravelEntries } from '../travel-phase';
import { calculateOverallStatus } from '../utils-data';

const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const data = generateDemoDataset(NOW, 'high-performing');
const priorityData = generateDemoDataset(NOW, 'priority');
const attentionData = generateDemoDataset(NOW, 'needs-attention');
const DONE = ['Passed', 'Issued', 'Completed'];

describe('demo dataset', () => {
  it('creates candidates over 4 centers and 4+4 agencies', () => {
    expect(data.candidates).toHaveLength(DEMO_CANDIDATE_COUNT);
    expect(new Set(data.candidates.map(c => c.country_of_origin))).toEqual(new Set(['Ethiopia']));
    expect(new Set(data.candidates.map(c => c.coc_facility_id).filter(Boolean)).size).toBe(4);
    expect(new Set(data.candidates.map(c => c.local_agency_id).filter(Boolean)).size).toBe(4);
    expect(new Set(data.candidates.map(c => c.foreign_agency_id).filter(Boolean)).size).toBe(4);
    expect(new Set(data.candidates.map(c => c.home_city)).size).toBeGreaterThan(60);
    expect(new Set(data.candidates.map(c => c.external_status?.destination_country)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(data.candidates.map(c => c.id)).size).toBe(DEMO_CANDIDATE_COUNT);
    expect(new Set(data.candidates.map(c => c.tracking_code)).size).toBe(DEMO_CANDIDATE_COUNT);
  });

  it('gives every local and foreign agency approved staff and routes tasks to the candidate\'s own agency', () => {
    const staffIds = new Set(data.staffUsers.map(user => user.id));
    data.localAgencies.forEach(agency => expect(data.staffUsers.filter(user => user.local_agency_id === agency.id && user.role === 'staff' && user.is_approved).length).toBeGreaterThanOrEqual(3));
    data.foreignAgencies.forEach(agency => expect(data.staffUsers.filter(user => user.foreign_agency_id === agency.id && user.role === 'foreign-agency-staff').length).toBeGreaterThanOrEqual(2));
    const candidateById = new Map(data.candidates.map(candidate => [candidate.id, candidate]));
    const assigned = data.stages.filter(stage => stage.assigned_staff_id);
    expect(assigned.length).toBeGreaterThan(100);
    assigned.forEach(stage => {
      expect(staffIds.has(stage.assigned_staff_id!)).toBe(true);
      const owner = data.staffUsers.find(user => user.id === stage.assigned_staff_id)!;
      expect(owner.local_agency_id).toBe(candidateById.get(stage.candidate_id)!.local_agency_id);
    });
  });

  it('adds trackable flights for in-transit candidates, some already airborne', () => {
    const flights = data.candidates.filter(candidate => candidate.flight);
    expect(flights.length).toBeGreaterThan(5);
    expect(flights.some(candidate => Date.parse(candidate.flight!.departure_time) < NOW)).toBe(true);
    expect(flights.some(candidate => Date.parse(candidate.flight!.departure_time) > NOW)).toBe(true);
    flights.forEach(candidate => expect(candidate.flight!.flight_number).toMatch(/^[A-Z0-9]{2}\d{1,4}$/));
  });

  it('includes returnees awaiting reapplication, reapplying, and redeployed with ordered histories', () => {
    const returnees = data.candidates.filter(candidate => candidate.employment_history?.length);
    expect(returnees).toHaveLength(35);
    expect(returnees.filter(candidate => !candidate.employment_history![0].reapplied_at && candidate.return_status === 'returned')).toHaveLength(10);
    expect(returnees.filter(candidate => candidate.employment_history![0].reapplied_at && !candidate.arrival)).toHaveLength(20);
    expect(returnees.filter(candidate => candidate.employment_history![0].reapplied_at && candidate.arrival)).toHaveLength(5);
    const entries = buildTravelEntries(returnees, data.stages, data.documents);
    expect(entries.filter(entry => entry.phase === 'returned')).toHaveLength(10);
    expect(entries.filter(entry => entry.phase === 'arrived')).toHaveLength(5);
    returnees.filter(candidate => candidate.employment_history![0].reapplied_at && candidate.arrival).forEach(candidate => {
      expect(candidate.work_contract_record?.status).toBe('received');
      expect(candidate.employer).toBeDefined();
      expect(candidate.visa?.status).toBe('validated');
      expect(data.stages.filter(stage => stage.candidate_id === candidate.id).every(stage => DONE.includes(stage.status))).toBe(true);
    });
    returnees.forEach(candidate => {
      const journey = candidate.employment_history![0];
      expect(Date.parse(journey.departed_at)).toBeLessThan(Date.parse(journey.returned_at));
      expect(Date.parse(journey.departed_at)).toBeLessThan(Date.parse(journey.contract_completed_at!));
      expect(Date.parse(journey.contract_completed_at!)).toBeLessThan(Date.parse(journey.returned_at));
      if (journey.reapplied_at) expect(Date.parse(journey.returned_at)).toBeLessThan(Date.parse(journey.reapplied_at));
      expect(Date.parse(journey.returned_at)).toBeLessThanOrEqual(NOW);
    });
  });

  it('keeps every timeline valid: 4 stages, in order, never in the future, never failed', () => {
    data.candidates.forEach(c => {
      const own = data.stages.filter(s => s.candidate_id === c.id);
      expect(own.map(s => s.stage_id)).toEqual(ALL_STAGES.map(s => s.id));
      expect(own.some(s => s.status === 'Failed')).toBe(false);
      own.forEach((s, i) => {
        if (DONE.includes(s.status) && i > 0) expect(DONE.includes(own[i - 1].status)).toBe(true);
        if (s.date) expect(new Date(s.date).getTime()).toBeLessThanOrEqual(NOW + 86_400_000);
      });
    });

  });

  it('labels registration-only demo candidates as in progress and excludes pregnancy exams for males', () => {
    const byCandidate = new Map<string, CandidateStage[]>();
    data.stages.forEach(stage => byCandidate.set(stage.candidate_id, [...(byCandidate.get(stage.candidate_id) ?? []), stage]));
    const registering = data.candidates.filter(candidate => byCandidate.get(candidate.id)?.find(stage => stage.stage_id === 1)?.status === 'In Progress');

    expect(registering.length).toBeGreaterThan(0);
    registering.forEach(candidate => expect(calculateOverallStatus(byCandidate.get(candidate.id) ?? [])).toBe('In Progress'));
    const maleIds = new Set(data.candidates.filter(candidate => candidate.gender === 'male').map(candidate => candidate.id));
    expect(data.medicals.some(result => maleIds.has(result.candidate_id) && result.exam_type === 'Pregnancy')).toBe(false);
  });

  it('uses the requested registration, training, medical, deployment stage order', () => {
    expect(ALL_STAGES.map(stage => stage.slug)).toEqual(['registration', 'training', 'medical', 'deployment']);
  });

  it('has unique stage dates across the population', () => {
    const days = new Set(data.stages.filter(s => s.date).map(s => s.date!.slice(0, 10)));
    expect(days.size).toBeGreaterThan(150);
  });

  it('gives demo candidates useful introductions and sample videos without labeling footage as real', () => {
    expect(data.candidates.every(c => !!c.professional_summary && !!c.skills?.length && !!c.languages?.length)).toBe(true);
    const sampleVideos = data.candidates.filter(c => c.intro_video_url);
    expect(sampleVideos).toHaveLength(DEMO_CANDIDATE_COUNT);
    expect(sampleVideos.every(c => c.intro_video_url === '/demo-intros/illustrative-introduction.mp4')).toBe(true);
  });

  it('has no duplicate ids that Supabase upserts would reject', () => {
    const ids = (items: Array<{ id: string }>) => new Set(items.map(i => i.id)).size === items.length;
    expect(ids(data.stages)).toBe(true);
    expect(ids(data.medicals)).toBe(true);
    expect(ids(data.payments)).toBe(true);
    expect(ids(data.logs)).toBe(true);
    const keys = data.paymentStatuses.map(p => `${p.candidateId}:${p.stageId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('triggers a broad set of integrity rules at every severity', () => {
    const findings = analyzeIntegrity({
      candidates: attentionData.candidates, stages: attentionData.stages, payments: attentionData.payments, paymentStatuses: attentionData.paymentStatuses,
      medicals: attentionData.medicals, logs: attentionData.logs, stageFees: { 1: 500, 2: 2200, 3: 2000, 4: 6000 }, now: NOW,
    });
    const rules = new Set(findings.map(f => f.rule));
    expect(rules.size).toBeGreaterThanOrEqual(40);
    const counts = countBySeverity(findings);
    expect(counts.critical).toBeGreaterThan(0);
    expect(counts.high).toBeGreaterThan(0);
    expect(counts.medium).toBeGreaterThan(0);
    expect(counts.low).toBeGreaterThan(0);
    expect(new Set(findings.map(f => f.id)).size).toBe(findings.length);
  });

  it('keeps Priority payment failures visible alongside its existing flags', () => {
    const findings = analyzeIntegrity({
      candidates: priorityData.candidates, stages: priorityData.stages, payments: priorityData.payments,
      paymentStatuses: priorityData.paymentStatuses, medicals: priorityData.medicals, logs: priorityData.logs,
      stageFees: { 1: 500, 2: 2200, 3: 2000, 4: 6000 }, now: NOW,
    });
    expect(findings, findings.map(f => f.rule).join(', ')).toHaveLength(11);
    expect(countBySeverity(findings)).toEqual({ critical: 2, high: 4, medium: 0, low: 5 });
    expect(findings.filter(f => f.rule === 'payment-not-settled')).toHaveLength(3);
    expect(riskScore(findings, priorityData.candidates.length)).toBe(92);
  });

  it('keeps High performing free of findings and Needs attention visibly off track', () => {
    const analyze = (scenario: typeof data) => analyzeIntegrity({
      candidates: scenario.candidates, stages: scenario.stages, payments: scenario.payments,
      paymentStatuses: scenario.paymentStatuses, medicals: scenario.medicals, logs: scenario.logs,
      stageFees: { 1: 500, 2: 2200, 3: 2000, 4: 6000 }, now: NOW,
    });
    const highFindings = analyze(data);
    expect(highFindings, highFindings.map(f => f.rule).join(', ')).toHaveLength(0);
    const attentionFindings = analyze(attentionData);
    expect(attentionFindings.some(f => f.rule === 'skipped-stage')).toBe(true);
    expect(riskScore(attentionFindings, attentionData.candidates.length)).toBeLessThan(80);
  });
});
