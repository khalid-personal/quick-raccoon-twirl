// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyIntegrityDemoScenario, buildIntegrityDemoScenario, INTEGRITY_DEMO_SCENARIOS, measureStoredIntegrityDemo, resetIntegrityDemoScenario } from '../demo-integrity-scenarios';
import { analyzeIntegrity, getIntegrityScoreLevel, riskScore } from '../integrity';
import { getApprovalLogs, getCandidates, getConfig, saveCandidates, saveConfig } from '../data-store';
import { ALL_STAGES } from '../types';
import { checkForeignPayment, isForeignPayment } from '../currency';
import { loadReconciliationEvents } from '../bank-statement-store';
import { bootDemo } from '../demo-loader';
import { DEMO_CANDIDATE_COUNT, generateDemoDataset } from '../demo-dataset';
import { updateCandidateDetails } from '../api/candidate-crud';
import { getPayments } from '../data-store';
import { agencyIsSuspended, amountDiscrepancies, decideAgencyCase, getAgencyResolutionCases } from '../agency-resolution';
import { loadBankStatement, saveBankStatement } from '../bank-statement-store';
import { stageFeeCovered, stageProgressBlockers } from '../stage-readiness';
import { reconcile } from '../bank-reconciliation';
import { getActiveStageTasks } from '../staff-tasks';
import { isCleared } from '../ksa-visa';

const now = new Date('2026-11-07T12:00:00Z').getTime();
const fees = { 1: 500, 3: 2200, 2: 2000, 4: 6000 };
const actor = { id: 'signed-in-superadmin', email: 'real-actor@example.test', role: 'superadmin' as const, authenticated: true };
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('dawm_demo_session', '1');
  saveConfig({ ...getConfig(), stageFees: fees });
});

describe('DEMO integrity scenario data, not score overrides', () => {
  it('preserves independent local and foreign staff assignments when rebuilding scenarios', () => {
    const base = generateDemoDataset(now, 'high-performing');
    const stage = { ...base.stages[0], assigned_staff_id: 'demo-usr-l4-s1', foreign_assigned_staff_id: 'foreign-staff-assignment' };
    const rebuilt = buildIntegrityDemoScenario('medium', fees, undefined, now, base.candidates, [stage]);
    expect(rebuilt.stages.find(item => item.candidate_id === stage.candidate_id && item.stage_id === stage.stage_id))
      .toMatchObject({ assigned_staff_id: stage.assigned_staff_id, foreign_assigned_staff_id: 'foreign-staff-assignment' });
  });

  it('calculates six distinct practice folders using the real rules and default thresholds', () => {
    const measurements = INTEGRITY_DEMO_SCENARIOS.map(scenario => {
      const data = buildIntegrityDemoScenario(scenario.id, fees, undefined, now);
      const risky = Math.round(scenario.risky * DEMO_CANDIDATE_COUNT / 120);
      const starting = Math.round(scenario.start * DEMO_CANDIDATE_COUNT / 120);
      const findings = analyzeIntegrity({ ...data, stageFees: fees, now });
      expect(data.measured.score).toBe(riskScore(findings, data.candidates.length));
      expect(data.measured.level).toBe(getIntegrityScoreLevel(data.measured.score));
      expect(findings.some(f => f.rule === 'skipped-stage' || f.rule === 'stage-without-payment')).toBe(false);
      expect(findings.filter(f => f.rule === 'elmis-mismatch')).toHaveLength(risky);
      expect(findings.filter(f => f.rule === 'stale-stage')).toHaveLength(risky);
      expect(findings.filter(f => f.rule === 'fee-mismatch' || f.rule === 'manual-no-reference')).toHaveLength(0);
      expect(findings.filter(f => f.rule === 'payment-not-settled')).toHaveLength(risky);
      expect(data.measured.bank.short + data.measured.bank.over + data.measured.bank.missing).toBe(risky);
      for (const source of ['foreign', 'candidate'] as const) {
        const events = data.evidence.filter(item => item.source === source).flatMap(item => item.events);
        expect(events).toHaveLength(source === 'foreign' ? risky : 0);
        if (risky && source === 'foreign') {
          expect(events.every(event => isForeignPayment(event.evidence!.payment!) === (source === 'foreign'))).toBe(true);
          const differences = data.evidence.filter(item => item.source === source).flatMap(item =>
            reconcile(data.payments.filter(payment => payment.payee_local_agency_id === item.agencyId && isForeignPayment(payment) === (source === 'foreign')), item.statement.lines).matches);
          for (const status of ['short', 'over', 'missing']) expect(differences.some(match => match.status === status)).toBe(true);
        }
      }
      expect(data.measured.candidates).toBe(435);
      expect(data.documents.length).toBeGreaterThan(0);
      expect(data.documents.every(document => document.file_name.startsWith('DEMO') && document.public_url?.startsWith('data:text/plain,'))).toBe(true);
      expect(data.candidates.filter(candidate => candidate.work_contract_record?.note?.includes('DEMO improving:'))).toHaveLength(Math.max(0, starting - risky));
      expect(data.candidates.filter(candidate => candidate.work_contract_record?.note?.includes('DEMO regressing:'))).toHaveLength(Math.max(0, risky - starting));
      expect(data.payments.length).toBeGreaterThan(0);
      expect(data.paymentStatuses).toHaveLength(1740);
      expect(data.stages).toHaveLength(1740);
      expect(data.candidates.map(candidate => [candidate.id, candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number]))
        .toEqual(generateDemoDataset(now, 'high-performing').candidates.map(candidate => [candidate.id, candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number]));
      expect(data.stages.every(stage => stage.notes?.startsWith('DEMO'))).toBe(true);
      expect(data.candidates.every(candidate => candidate.clearance?.labour_ministry?.simulated && !candidate.clearance.labour_ministry.qr_image_url)).toBe(true);
      expect(data.payments.every(payment => payment.amount > 0)).toBe(true);
      expect(data.payments.filter(payment => !isForeignPayment(payment)).every(payment => payment.amount === fees[payment.stage_id as keyof typeof fees])).toBe(true);
      expect(data.payments.filter(payment => payment.status !== 'succeeded')).toHaveLength(risky);
      data.evidence.forEach(({ statement }) => statement.lines.forEach(line => {
        expect(line.description).toMatch(/TRK-D\d{4}/);
        expect(line.description).toContain('Practice / synthetic');
        expect(line.description).toContain('not real bank proof');
      }));
      data.payments.filter(isForeignPayment).forEach(payment => expect(checkForeignPayment(payment, data.candidates)).toBeNull());
      data.candidates.forEach(candidate => {
        const stages = data.stages.filter(stage => stage.candidate_id === candidate.id);
        expect(stages.map(stage => stage.stage_id)).toEqual(ALL_STAGES.map(stage => stage.id));
        const firstUnfinished = stages.findIndex(stage => stage.status !== 'Completed');
        const current = firstUnfinished < 0 ? 4 : firstUnfinished;
        expect(stages.slice(current + 1).every(stage => stage.status === 'Pending')).toBe(true);
        stages.forEach(stage => expect(stageProgressBlockers(candidate, stage.stage_id, stage.status, data.stages, fees, data.paymentStatuses, data.payments)).toEqual([]));
        data.payments.filter(payment => payment.payer_candidate_id === candidate.id).forEach(payment => {
          expect(ALL_STAGES.findIndex(stage => stage.id === payment.stage_id)).toBeLessThanOrEqual(current);
        });
        data.paymentStatuses.filter(status => status.candidateId === candidate.id).forEach(status => {
          expect(status.isPaid).toBe(stageFeeCovered(candidate, status.stageId, fees, data.paymentStatuses, data.payments));
        });
        if (current < 4 && !stageFeeCovered(candidate, stages[current].stage_id, fees, data.paymentStatuses, data.payments)) {
          expect(stageProgressBlockers(candidate, stages[current].stage_id, 'Completed', data.stages, fees, data.paymentStatuses, data.payments).length).toBeGreaterThan(0);
        }
        const medicals = data.medicals.filter(medical => medical.candidate_id === candidate.id);
        expect(medicals.every(medical => medical.status === 'Passed')).toBe(current >= 3 || current < 2);
        if (current < 2) expect(medicals).toHaveLength(0);
        if (current >= 2) expect(medicals.map(medical => medical.exam_type)).toEqual(candidate.gender === 'male'
          ? ['HIV', 'Final Agency Medical'] : ['HIV', 'Pregnancy', 'Final Agency Medical']);
        expect(candidate.visa?.status === 'validated').toBe(current >= 3);
        expect(data.documents.filter(document => document.candidate_id === candidate.id).map(document => document.doc_kind))
          .toEqual(current === 0 ? [] : current >= 3 ? ['work_contract', 'visa'] : ['work_contract']);
        expect(data.payments.filter(payment => isForeignPayment(payment) && payment.candidate_ids.includes(candidate.id))).toHaveLength(current >= 2 ? 1 : 0);
        if (candidate.last_payment_id) expect(data.payments.some(payment => payment.id === candidate.last_payment_id)).toBe(true);
        stages.filter(stage => stage.status === 'Completed').forEach(stage => {
          const payment = data.payments.find(payment => payment.stage_id === stage.stage_id && payment.candidate_ids.includes(candidate.id))!;
          expect(payment.amount).toBe(fees[stage.stage_id as keyof typeof fees]);
          expect(data.paymentStatuses.find(status => status.candidateId === candidate.id && status.stageId === stage.stage_id)?.isPaid).toBe(true);
        });
      });
      const histogram = ALL_STAGES.map(stage => data.candidates.filter(candidate =>
        data.stages.find(record => record.candidate_id === candidate.id && record.status !== 'Completed')?.stage_id === stage.id).length);
      const unpaidRegistration = data.candidates.filter(candidate => !stageFeeCovered(candidate, 1, fees, data.paymentStatuses, data.payments)).length;
      const deployed = data.candidates.filter(candidate => data.stages.filter(stage => stage.candidate_id === candidate.id).every(stage => stage.status === 'Completed')).length;
      const tasks = getActiveStageTasks(data.candidates, data.stages, now, { fees, statuses: data.paymentStatuses, payments: data.payments });
      return { id: scenario.id, start: data.starting.score, score: data.measured.score, level: data.measured.level,
        bank: data.measured.bank, payments: data.payments.length, documents: data.documents.length, histogram, unpaidRegistration, deployed,
        overdue: tasks.filter(task => task.overdue).length, tasks: tasks.length };
    });
    console.log('DEMO achieved measurements', JSON.stringify(measurements));
    expect(measurements.map(item => item.level)).toEqual(['red', 'yellow', 'yellow', 'green', 'yellow', 'green']);
    expect(new Set(measurements.map(item => item.score)).size).toBe(6);
    expect(measurements.map(item => item.score)).toEqual([43, 71, 75, 93, 81, 100]);
    expect(measurements[1].start).toBeLessThan(measurements[1].score);
    expect(measurements[3].start).toBeLessThan(measurements[3].score);
    expect(measurements[4].start).toBeGreaterThan(measurements[4].score);
    expect(measurements[0].bank.short).toBeGreaterThan(0);
    expect(measurements[0].bank.over).toBeGreaterThan(0);
    expect(measurements[0].bank.missing).toBeGreaterThan(0);
    expect(measurements[5].bank.matched).toBe(measurements[5].payments);
    expect(new Set(measurements.map(item => JSON.stringify(item.histogram))).size).toBe(6);
    expect(measurements.every(item => item.histogram.every(count => count > 0) && item.histogram.reduce((sum, count) => sum + count, 0) + item.deployed === 435)).toBe(true);
    expect(measurements[0].histogram[0]).toBeGreaterThan(measurements[2].histogram[0]);
    expect(measurements[2].histogram[0]).toBeGreaterThan(measurements[5].histogram[0]);
    expect(measurements[0].unpaidRegistration).toBeGreaterThan(measurements[2].unpaidRegistration);
    expect(measurements[2].unpaidRegistration).toBeGreaterThan(measurements[5].unpaidRegistration);
    const ranked = [measurements[0], measurements[1], measurements[2], measurements[4], measurements[3], measurements[5]];
    for (let index = 1; index < ranked.length; index++) {
      expect(ranked[index].deployed).toBeGreaterThan(ranked[index - 1].deployed);
      expect(ranked[index].overdue).toBeLessThan(ranked[index - 1].overdue);
      expect(ranked[index].unpaidRegistration).toBeLessThan(ranked[index - 1].unpaidRegistration);
    }
    expect(measurements[5].deployed / 435).toBeGreaterThanOrEqual(0.8);
    expect(measurements[5].overdue).toBe(0);
    expect(measurements[5].unpaidRegistration).toBe(0);
    expect(measurements[0].deployed / 435).toBeLessThan(0.03);
    expect(measurements[0].overdue / measurements[0].tasks).toBeGreaterThan(0.75);
  }, 30_000);

  it('uses configured thresholds unchanged and refuses free or invalid stages', () => {
    const data = buildIntegrityDemoScenario('medium', fees, { greenMin: 70, yellowMin: 40 }, now);
    expect(data.measured.level).toBe(getIntegrityScoreLevel(data.measured.score, { greenMin: 70, yellowMin: 40 }));
    expect(() => buildIntegrityDemoScenario('high', { ...fees, 4: 0 })).toThrow('positive');
    expect(() => buildIntegrityDemoScenario('high', { ...fees, 2: NaN })).toThrow('positive');
    expect(JSON.stringify(buildIntegrityDemoScenario('low-medium', fees, undefined, now))).toBe(JSON.stringify(buildIntegrityDemoScenario('low-medium', fees, undefined, now)));
  }, 30_000);

  it('keeps high-mode intake timely, all reached fees paid and completed journeys in chronological order', () => {
    const data = buildIntegrityDemoScenario('high', fees, undefined, now);
    expect(data.measured.findings).toBe(0);
    expect(data.measured.deployed / data.candidates.length).toBeGreaterThanOrEqual(0.8);
    expect(data.stages.filter(stage => stage.status === 'Completed').length / data.stages.length).toBeGreaterThanOrEqual(0.9);
    expect(data.measured.returned).toBeGreaterThan(0);
    expect(data.measured.activeTasks).toBeGreaterThan(0);
    expect(data.measured.overdueTasks).toBe(0);
    expect(data.candidates.every(candidate => !isCleared(candidate))).toBe(true);
    const recent = data.candidates.filter(candidate => now - Date.parse(candidate.created_at) <= 7 * 86_400_000);
    expect(recent.length).toBeGreaterThan(20);
    expect(recent.every(candidate => candidate.elmis?.status === 'verified')).toBe(true);
    for (const candidate of data.candidates) {
      const stages = data.stages.filter(stage => stage.candidate_id === candidate.id);
      const reached = stages.findIndex(stage => stage.status !== 'Completed');
      for (const stage of stages.slice(0, reached < 0 ? 4 : reached + 1)) {
        expect(stageFeeCovered(candidate, stage.stage_id, fees, data.paymentStatuses, data.payments)).toBe(true);
      }
      if (!candidate.arrival) continue;
      expect(candidate.flight?.arrival_airport).not.toBe('');
      const departure = Date.parse(stages[3].date!);
      expect(Date.parse(candidate.created_at)).toBeLessThan(departure);
      expect(Date.parse(candidate.flight!.departure_time)).toBe(departure);
      expect(Date.parse(candidate.arrival.arrived_at)).toBeGreaterThan(departure);
      expect(data.medicals.filter(medical => medical.candidate_id === candidate.id).every(medical =>
        medical.status === 'Passed' && Date.parse(medical.exam_date!) <= departure)).toBe(true);
      expect(data.payments.filter(payment => payment.candidate_ids.includes(candidate.id)).every(payment => Date.parse(payment.created_at) <= departure)).toBe(true);
      if (candidate.return_status === 'returned') {
        expect(Date.parse(candidate.actual_return_date!)).toBeGreaterThan(Date.parse(candidate.arrival.arrived_at));
        expect(candidate.employment_history?.[0].returned_at).toBeTruthy();
      }
    }
  });

  it('guards every write against live mode, unsigned users, wrong roles and missing confirmation/reason', async () => {
    const snapshot = () => JSON.stringify({ ...localStorage });
    const before = snapshot();
    for (const bad of [{ ...actor, role: 'admin' as const }, { ...actor, authenticated: false }, { ...actor, id: '' }]) {
      await expect(applyIntegrityDemoScenario('high', bad, true, 'Practice')).rejects.toThrow('superadmin');
      expect(() => resetIntegrityDemoScenario(bad, true, 'Practice')).toThrow('superadmin');
    }
    await expect(applyIntegrityDemoScenario('high', actor, false, 'Practice')).rejects.toThrow('Confirm');
    expect(() => resetIntegrityDemoScenario(actor, true, '')).toThrow('Confirm');
    sessionStorage.removeItem('dawm_demo_session');
    await expect(applyIntegrityDemoScenario('high', actor, true, 'Practice')).rejects.toThrow('superadmin');
    expect(snapshot()).toBe(before);
  });

  it('persists actual measurements and actor audit, preserves live storage/auth, and reverses via normal reload', async () => {
    localStorage.setItem('dawm_candidates', 'LIVE CANDIDATES');
    localStorage.setItem('dawm_bank_statement:demo-local-1', 'LIVE BANK FILE');
    localStorage.setItem('sb-test-auth-token', 'LIVE AUTH');
    localStorage.setItem('live-upload-file', 'LIVE UPLOAD');
    const live = Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('dawm_demo_')));
    const session = { ...sessionStorage };
    const result = await applyIntegrityDemoScenario('low-medium', actor, true, 'Practice fixing missing slips');
    expect(result.after).toEqual(measureStoredIntegrityDemo());
    expect(result.after.level).toBe('yellow');
    expect(getCandidates()).toHaveLength(435);
    expect(getApprovalLogs().at(-1)).toMatchObject({ actor_id: actor.id, actor_email: actor.email });
    expect(getApprovalLogs().at(-1)?.description).toContain(`after=${result.after.score}/${result.after.level}`);
    expect(loadReconciliationEvents('demo-local-1').every(event => event.synthetic && event.note.startsWith('DEMO'))).toBe(true);
    const storedBeforeBoot = { ...localStorage };
    bootDemo();
    expect({ ...localStorage }).toEqual(storedBeforeBoot);
    expect(getCandidates()).toHaveLength(435);
    expect(result.after).toEqual(measureStoredIntegrityDemo());
    const reset = resetIntegrityDemoScenario(actor, true, 'Back to the normal practice folder');
    expect(getCandidates()).toHaveLength(435);
    expect(reset.after).toEqual(measureStoredIntegrityDemo());
    expect(getApprovalLogs().filter(log => log.target_id === 'demo-integrity-scenarios')).toHaveLength(2);
    expect(Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('dawm_demo_') && key !== 'demo:dawm-agency-resolution'))).toEqual(live);
    expect(Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key !== 'dawm_demo_version'))).toEqual(session);
  }, 30_000);
});
it('keeps identity edits, tracking codes and legacy additional candidates across every mode', async () => {
  await applyIntegrityDemoScenario('high', actor, true, 'Named practice roster');
  const first = getCandidates()[0];
  await updateCandidateDetails(first.id, { first_name: 'EditedName', tracking_code: 'TRK-EDITED' }, actor.id, actor.email);
  const created = { ...first, id: 'legacy-additional-candidate', first_name: 'NewName', tracking_code: 'TRK-NEW-DEMO', passport_number: 'NEW-PASSPORT', email: 'new@example.test' };
  saveCandidates([...getCandidates(), created]);
  for (const scenario of INTEGRITY_DEMO_SCENARIOS) {
    await applyIntegrityDemoScenario(scenario.id, actor, true, 'Switch without renaming');
    expect(getCandidates()).toHaveLength(436);
    expect(getCandidates().find(candidate => candidate.id === first.id)).toMatchObject({ first_name: 'EditedName', tracking_code: 'TRK-EDITED' });
    expect(getCandidates().find(candidate => candidate.id === created.id)).toMatchObject({ first_name: 'NewName', tracking_code: 'TRK-NEW-DEMO' });
    getPayments().filter(payment => payment.candidate_ids.includes(first.id)).forEach(payment =>
      expect(payment.demo_evidence?.identities[0].tracking_code).toBe('TRK-EDITED'));
    const current = getCandidates().find(candidate => candidate.id === first.id)!;
    expect(current.last_payment_id ? getPayments().some(payment => payment.id === current.last_payment_id) : true).toBe(true);
  }
  await updateCandidateDetails(created.id, { last_name: 'EditableAfterSwitch' }, actor.id, actor.email);
  expect(getCandidates().find(candidate => candidate.id === created.id)?.last_name).toBe('EditableAfterSwitch');
}, 30000);
it('restores the previous demo mode after a storage failure instead of leaving partially switched evidence', async () => {
  await applyIntegrityDemoScenario('high', actor, true, 'Initial complete demo');
  const before = { ...localStorage };
  const original = Storage.prototype.setItem;
  let failed = false;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'dawm_demo_mock_payments' && !failed) { failed = true; throw new DOMException('Storage full', 'QuotaExceededError'); }
    return original.call(this, key, value);
  });
  try {
    await expect(applyIntegrityDemoScenario('low', actor, true, 'Simulated storage failure')).rejects.toThrow('previous demo records were restored');
    expect({ ...localStorage }).toEqual(before);
    expect(getCandidates()).toHaveLength(435);
  } finally { spy.mockRestore(); }
});

it.each(INTEGRITY_DEMO_SCENARIOS)('applies $id to the actual payment and agency review stores, then refreshes completed data', async scenario => {
  const refreshed: ReturnType<typeof measureStoredIntegrityDemo>[] = [];
  const onRefresh = () => refreshed.push(measureStoredIntegrityDemo());
  window.addEventListener('demo-scenario-changed', onRefresh);
  try {
      const result = await applyIntegrityDemoScenario(scenario.id, actor, true, 'Practice actual evidence review');
      expect(result.after).toEqual(measureStoredIntegrityDemo());
      expect(refreshed.at(-1)).toEqual(result.after);
      expect(sessionStorage.getItem('dawm_integrity_scenario')).toBe(scenario.id);
      const open = getAgencyResolutionCases().filter(record => record.state !== 'resolved');
      const issues = amountDiscrepancies();
      const index = INTEGRITY_DEMO_SCENARIOS.findIndex(item => item.id === scenario.id);
      // The existing priority roster has identity/contact warnings. Scenario
      // switching preserves these rather than secretly fixing passport edits.
      expect(result.after.score).toBeLessThanOrEqual([43, 71, 75, 93, 81, 100][index]);
      expect(result.after.score).toBeGreaterThanOrEqual([43, 71, 75, 93, 81, 100][index] - 5);
      expect(result.after.flaggedPayments).toBe([44, 18, 15, 4, 11, 0][index]);
      expect(open).toHaveLength([2, 2, 1, 1, 1, 0][index]);
      if (scenario.id !== 'high') {
        expect(result.after.openPaymentCases).toBeGreaterThan(0);
        expect(open.length).toBeGreaterThan(0);
        open.forEach(record => {
          expect(record).toMatchObject({ state: 'escalated', holdActive: false });
          expect(record.issue).toMatchObject({ source: 'foreign', agencyType: 'foreign' });
          expect(issues.find(issue => issue.id === record.issue.id)?.snapshot).toBe(record.issue.snapshot);
          expect(record.events[0]).toMatchObject({ actorId: actor.id, actor: actor.email });
          expect(record.events[0].reason).toContain('DEMO ONLY');
          expect(getApprovalLogs().find(log => log.id === record.events[0].auditId)?.target_id).toBe(record.issue.paymentId);
          expect(agencyIsSuspended(record.issue.agencyType, record.issue.agencyId)).toBe(false);
        });
      } else {
        expect(result.after).toMatchObject({ flaggedPayments: 0, openPaymentCases: 0, openAgencyCases: 0 });
        expect(amountDiscrepancies()).toHaveLength(0);
      }
      const storedCharacters = Object.entries(localStorage).reduce((total, [key, value]) => total + key.length + value.length, 0);
      expect(storedCharacters).toBeLessThan(5_000_000);
      const storedBeforeBoot = { ...localStorage };
      bootDemo();
      expect({ ...localStorage }).toEqual(storedBeforeBoot);
      expect(result.after).toEqual(measureStoredIntegrityDemo());
      const refreshedIssues = amountDiscrepancies();
      open.forEach(record => expect(refreshedIssues.find(issue => issue.id === record.issue.id)?.snapshot).toBe(record.issue.snapshot));
      console.log('Stored scenario', scenario.id, result.after.score, result.after.flaggedPayments, issues.length, open.length, storedCharacters);
  } finally { window.removeEventListener('demo-scenario-changed', onRefresh); }
}, 30_000);

it('does not discard operator agency holds or uploaded bank files when changing practice modes', async () => {
  await applyIntegrityDemoScenario('medium', actor, true, 'Initial review example');
  const record = getAgencyResolutionCases()[0];
  await decideAgencyCase(record.id, 'suspend', 'Operator investigated the synthetic bank gap', actor);
  const held = { ...localStorage };
  await expect(applyIntegrityDemoScenario('high', actor, true, 'Try to bypass the hold')).rejects.toThrow('reinstate');
  expect(() => resetIntegrityDemoScenario(actor, true, 'Try reset')).toThrow('reinstate');
  expect({ ...localStorage }).toEqual(held);
  await decideAgencyCase(record.id, 'reinstate', 'Operator explicitly releases the practice hold', actor);
  const statement = loadBankStatement('demo-local-1', 'candidate')!;
  saveBankStatement('demo-local-1', { ...statement, synthetic: false, name: 'Uploaded real statement' }, 'candidate');
  const uploaded = { ...localStorage };
  await expect(applyIntegrityDemoScenario('high', actor, true, 'Keep uploaded real evidence')).rejects.toThrow('uploaded statement');
  expect(() => resetIntegrityDemoScenario(actor, true, 'Keep uploaded real evidence')).toThrow('uploaded statement');
  expect({ ...localStorage }).toEqual(uploaded);
}, 30_000);

it('rolls back generated agency cases and audits when storage fails after escalation', async () => {
  await applyIntegrityDemoScenario('high', actor, true, 'Previous practice example');
  const before = { ...localStorage };
  const previousScenario = sessionStorage.getItem('dawm_integrity_scenario');
  const original = Storage.prototype.setItem;
  let failed = false;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'dawm_demo_mock_approval_logs' && !failed && getAgencyResolutionCases().length > 0) {
      failed = true;
      throw new DOMException('Storage full after review creation', 'QuotaExceededError');
    }
    return original.call(this, key, value);
  });
  try {
    await expect(applyIntegrityDemoScenario('low', actor, true, 'Exercise audited rollback')).rejects.toThrow('previous demo records were restored');
    expect(failed).toBe(true);
    expect({ ...localStorage }).toEqual(before);
    expect(sessionStorage.getItem('dawm_integrity_scenario')).toBe(previousScenario);
    expect(getAgencyResolutionCases()).toHaveLength(0);
  } finally { spy.mockRestore(); }
}, 30_000);
