// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_STAGES } from '../types';
import { backtrackDemoAgencyTimelines } from '../demo-agency-timeline';
import { applyIntegrityDemoScenario, buildIntegrityDemoScenario, INTEGRITY_DEMO_SCENARIOS } from '../demo-integrity-scenarios';
import { agencyIsSuspended, agencyReviewEvidence, decideAgencyCase, getAgencyResolutionCases, requireAgencyOperations } from '../agency-resolution';
import { getApprovalLogs, getConfig, saveConfig } from '../data-store';
import { stageIsComplete, stageProgressBlockers } from '../stage-readiness';
import { foreignUnderpaymentStatus } from '../foreign-underpayment-policy';

const now = Date.parse('2026-11-07T12:00:00Z');
const fees = { 1: 500, 3: 2200, 2: 2000, 4: 6000 };
const actor = { id: 'demo-superadmin', email: 'superadmin1@dawm.test', role: 'superadmin' as const, authenticated: true };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem('dawm_demo_session', '1');
  saveConfig({ ...getConfig(), stageFees: fees });
});

describe('demo agency pause timelines', () => {
  it('seeds exactly three distinct Low-mode holds from one candidate transfer each, with two audited appeals', async () => {
    await applyIntegrityDemoScenario('low', actor, true, 'Practice ministry pause and appeal review');
    const cases = getAgencyResolutionCases();
    expect(cases).toHaveLength(3);
    expect(new Set(cases.map(record => record.issue.agencyId)).size).toBe(3);
    expect(cases.filter(record => record.state === 'appealed')).toHaveLength(2);
    for (const record of cases) {
      expect(record.holdActive).toBe(true);
      expect(record.events.filter(event => event.action === 'suspend')).toHaveLength(1);
      expect(record.events.filter(event => event.action.includes('verified-underpayment'))).toHaveLength(0);
      expect(Date.parse(record.events.find(event => event.action === 'suspend')!.at)).toBeGreaterThan(Date.parse(record.dueDate));
      expect(agencyReviewEvidence(record.issue).candidate).toBeDefined();
      expect(agencyReviewEvidence(record.issue).checks.every(check => check.passed)).toBe(true);
      expect(agencyIsSuspended('foreign', record.issue.agencyId)).toBe(true);
      expect(foreignUnderpaymentStatus(record.issue.agencyId, cases, getConfig()).remaining).toBe(2);
      expect(() => requireAgencyOperations('foreign', record.issue.agencyId)).toThrow('suspended');
      for (const event of record.events) {
        const log = getApprovalLogs().find(log => log.id === event.auditId);
        expect(log).toMatchObject({ actor_id: event.actorId, actor_email: event.actor, timestamp: event.at, target_id: record.issue.paymentId });
      }
    }
    await applyIntegrityDemoScenario('high', actor, true, 'Switch untouched generated practice holds');
    expect(getAgencyResolutionCases()).toHaveLength(0);
  }, 120_000);

  it('does not replace a generated hold after an operator records a decision', async () => {
    await applyIntegrityDemoScenario('low', actor, true, 'Open practice appeals');
    const record = getAgencyResolutionCases()[0];
    await decideAgencyCase(record.id, 'request-follow-up', 'Ministry asks for further candidate evidence', actor);
    await expect(applyIntegrityDemoScenario('high', actor, true, 'Cannot bypass an operator hold')).rejects.toThrow('reinstate');
    expect(agencyIsSuspended('foreign', record.issue.agencyId)).toBe(true);
  }, 30_000);

  it.each(INTEGRITY_DEMO_SCENARIOS)('backtracks post-pause progress in $id without affecting other agencies or pre-pause receipts', scenario => {
    const data = buildIntegrityDemoScenario(scenario.id, fees, undefined, now);
    const candidate = data.candidates.find(candidate => data.stages.some(stage => stage.candidate_id === candidate.id && stageIsComplete(stage.status)))!;
    const agencyId = candidate.foreign_agency_id!;
    const records = ALL_STAGES.map(stage => data.stages.find(record => record.candidate_id === candidate.id && record.stage_id === stage.id)!);
    const first = records[0];
    const cutoff = new Date(Date.parse(first.date!) + 60_000).toISOString();
    records[1].status = 'Completed'; records[1].date = new Date(Date.parse(cutoff) + 86_400_000).toISOString();
    records[1].updated_at = records[1].date;
    const other = data.candidates.find(record => record.foreign_agency_id !== agencyId)!;
    const otherBefore = JSON.stringify(other);
    const beforeReceiptIds = data.payments.filter(payment => payment.candidate_ids.includes(candidate.id) && Date.parse(payment.created_at) <= Date.parse(cutoff)).map(payment => payment.id);
    candidate.flight = { flight_number: 'DEMO-POST-PAUSE', departure_airport: 'ADD', arrival_airport: 'RUH', departure_time: records[1].date };
    backtrackDemoAgencyTimelines(data, new Map([[agencyId, cutoff]]), fees);
    expect(data.stages.find(stage => stage.id === first.id)?.status).toBe('Completed');
    expect(data.stages.filter(stage => stage.candidate_id === candidate.id && stage.stage_id !== first.stage_id).every(stage => stage.status === 'Pending')).toBe(true);
    expect(candidate.flight).toBeUndefined();
    expect(candidate.arrival).toBeUndefined();
    expect(candidate.clearance?.labour_ministry?.status).toBe('pending');
    expect(JSON.stringify(other)).toBe(otherBefore);
    expect(data.payments.filter(payment => payment.candidate_ids.includes(candidate.id)).every(payment => Date.parse(payment.created_at) <= Date.parse(cutoff))).toBe(true);
    expect(data.payments.some(payment => payment.id === beforeReceiptIds[0])).toBe(true);
    for (const stage of data.stages.filter(stage => stage.candidate_id === candidate.id)) {
      expect(stageProgressBlockers(candidate, stage.stage_id, stage.status, data.stages, fees, data.paymentStatuses, data.payments)).toEqual([]);
    }
  }, 30_000);

  it('preserves actual return support after a pause when deployment happened earlier', () => {
    const data = buildIntegrityDemoScenario('high', fees, undefined, now);
    const candidate = data.candidates.find(candidate => candidate.return_status === 'returned')!;
    const history = JSON.stringify(candidate.employment_history);
    const supportDocument = { ...data.documents[0], id: 'demo-return-support', candidate_id: candidate.id, stage_id: undefined, uploaded_at: new Date(now).toISOString() };
    data.documents.push(supportDocument);
    const cutoff = new Date(now - 2 * 86_400_000).toISOString();
    backtrackDemoAgencyTimelines(data, new Map([[candidate.foreign_agency_id!, cutoff]]), fees);
    expect(candidate.return_status).toBe('returned');
    expect(candidate.actual_return_date).toBeDefined();
    expect(JSON.stringify(candidate.employment_history)).toBe(history);
    expect(candidate.arrival).toBeDefined();
    expect(data.documents).toContain(supportDocument);
  });
});
