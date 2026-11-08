// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyIntegrityDemoScenario, buildIntegrityDemoScenario, INTEGRITY_DEMO_SCENARIOS, measureStoredIntegrityDemo, resetIntegrityDemoScenario } from '../demo-integrity-scenarios';
import { analyzeIntegrity, getIntegrityScoreLevel, riskScore } from '../integrity';
import { getApprovalLogs, getCandidates, getConfig, saveConfig } from '../data-store';
import { ALL_STAGES } from '../types';
import { checkForeignPayment, isForeignPayment } from '../currency';
import { loadReconciliationEvents } from '../bank-statement-store';
import { bootDemo } from '../demo-loader';
import { DEMO_CANDIDATE_COUNT, generateDemoDataset } from '../demo-dataset';
import { createCandidate, updateCandidateDetails } from '../api/candidate-crud';
import { getPayments } from '../data-store';

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
      expect(findings.filter(f => f.rule === 'fee-mismatch')).toHaveLength(risky);
      expect(findings.filter(f => f.rule === 'manual-no-reference')).toHaveLength(risky);
      expect(data.measured.bank.short + data.measured.bank.over + data.measured.bank.missing).toBe(risky);
      expect(data.measured.candidates).toBe(435);
      expect(data.documents).toHaveLength(870);
      expect(data.documents.every(document => document.file_name.startsWith('DEMO') && document.public_url?.startsWith('data:text/plain,'))).toBe(true);
      expect(data.candidates.filter(candidate => candidate.work_contract_record?.note?.includes('DEMO improving:'))).toHaveLength(Math.max(0, starting - risky));
      expect(data.candidates.filter(candidate => candidate.work_contract_record?.note?.includes('DEMO regressing:'))).toHaveLength(Math.max(0, risky - starting));
      expect(data.payments).toHaveLength(2175);
      expect(data.paymentStatuses).toHaveLength(1740);
      expect(data.stages).toHaveLength(1740);
      expect(data.candidates.map(candidate => [candidate.id, candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number]))
        .toEqual(generateDemoDataset(now, 'high-performing').candidates.map(candidate => [candidate.id, candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number]));
      expect(data.stages.every(stage => stage.notes?.startsWith('DEMO'))).toBe(true);
      expect(data.candidates.every(candidate => candidate.clearance?.labour_ministry?.status === 'pending'
        && candidate.clearance.labour_ministry.simulated && !candidate.clearance.labour_ministry.qr_image_url)).toBe(true);
      expect(data.payments.every(payment => payment.amount > 0 && payment.status === 'succeeded')).toBe(true);
      data.payments.filter(isForeignPayment).forEach(payment => expect(checkForeignPayment(payment, data.candidates)).toBeNull());
      data.candidates.forEach(candidate => {
        const stages = data.stages.filter(stage => stage.candidate_id === candidate.id);
        expect(stages.map(stage => stage.stage_id)).toEqual(ALL_STAGES.map(stage => stage.id));
        expect(stages.map(stage => stage.status)).toEqual(['Completed', 'Completed', 'Completed', 'In Progress']);
        stages.filter(stage => stage.status === 'Completed').forEach(stage => {
          const payment = data.payments.find(payment => payment.stage_id === stage.stage_id && payment.candidate_ids.includes(candidate.id))!;
          expect(payment.amount).toBe(fees[stage.stage_id as keyof typeof fees]);
          expect(data.paymentStatuses.find(status => status.candidateId === candidate.id && status.stageId === stage.stage_id)?.isPaid).toBe(true);
        });
      });
      return { id: scenario.id, start: data.starting.score, score: data.measured.score, level: data.measured.level, bank: data.measured.bank };
    });
    console.log('DEMO achieved measurements', JSON.stringify(measurements));
    expect(measurements.map(item => item.level)).toEqual(['red', 'yellow', 'yellow', 'green', 'yellow', 'green']);
    expect(new Set(measurements.map(item => item.score)).size).toBe(6);
    expect(measurements[1].start).toBeLessThan(measurements[1].score);
    expect(measurements[3].start).toBeLessThan(measurements[3].score);
    expect(measurements[4].start).toBeGreaterThan(measurements[4].score);
    expect(measurements[0].bank.short).toBeGreaterThan(0);
    expect(measurements[0].bank.over).toBeGreaterThan(0);
    expect(measurements[0].bank.missing).toBeGreaterThan(0);
    expect(measurements[5].bank.matched).toBe(2175);
  }, 30_000);

  it('uses configured thresholds unchanged and refuses free or invalid stages', () => {
    const data = buildIntegrityDemoScenario('medium', fees, { greenMin: 70, yellowMin: 40 }, now);
    expect(data.measured.level).toBe(getIntegrityScoreLevel(data.measured.score, { greenMin: 70, yellowMin: 40 }));
    expect(() => buildIntegrityDemoScenario('high', { ...fees, 4: 0 })).toThrow('positive');
    expect(() => buildIntegrityDemoScenario('high', { ...fees, 2: NaN })).toThrow('positive');
    expect(JSON.stringify(buildIntegrityDemoScenario('low-medium', fees, undefined, now))).toBe(JSON.stringify(buildIntegrityDemoScenario('low-medium', fees, undefined, now)));
  }, 30_000);

  it('guards every write against live mode, unsigned users, wrong roles and missing confirmation/reason', () => {
    const snapshot = () => JSON.stringify({ ...localStorage });
    const before = snapshot();
    for (const bad of [{ ...actor, role: 'admin' as const }, { ...actor, authenticated: false }, { ...actor, id: '' }]) {
      expect(() => applyIntegrityDemoScenario('high', bad, true, 'Practice')).toThrow('superadmin');
      expect(() => resetIntegrityDemoScenario(bad, true, 'Practice')).toThrow('superadmin');
    }
    expect(() => applyIntegrityDemoScenario('high', actor, false, 'Practice')).toThrow('Confirm');
    expect(() => resetIntegrityDemoScenario(actor, true, '')).toThrow('Confirm');
    sessionStorage.removeItem('dawm_demo_session');
    expect(() => applyIntegrityDemoScenario('high', actor, true, 'Practice')).toThrow('superadmin');
    expect(snapshot()).toBe(before);
  });

  it('persists actual measurements and actor audit, preserves live storage/auth, and reverses via normal reload', () => {
    localStorage.setItem('dawm_candidates', 'LIVE CANDIDATES');
    localStorage.setItem('dawm_bank_statement:demo-local-1', 'LIVE BANK FILE');
    localStorage.setItem('sb-test-auth-token', 'LIVE AUTH');
    localStorage.setItem('live-upload-file', 'LIVE UPLOAD');
    const live = Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('dawm_demo_')));
    const session = { ...sessionStorage };
    const result = applyIntegrityDemoScenario('low-medium', actor, true, 'Practice fixing missing slips');
    expect(result.after).toEqual(measureStoredIntegrityDemo());
    expect(result.after.level).toBe('yellow');
    expect(getCandidates()).toHaveLength(435);
    expect(getApprovalLogs().at(-1)).toMatchObject({ actor_id: actor.id, actor_email: actor.email });
    expect(getApprovalLogs().at(-1)?.description).toContain(`after=${result.after.score}/${result.after.level}`);
    expect(loadReconciliationEvents('demo-local-1').every(event => event.synthetic && event.note.startsWith('DEMO'))).toBe(true);
    bootDemo();
    expect(getCandidates()).toHaveLength(435);
    expect(result.after).toEqual(measureStoredIntegrityDemo());
    const reset = resetIntegrityDemoScenario(actor, true, 'Back to the normal practice folder');
    expect(getCandidates()).toHaveLength(435);
    expect(reset.after).toEqual(measureStoredIntegrityDemo());
    expect(getApprovalLogs().filter(log => log.target_id === 'demo-integrity-scenarios')).toHaveLength(2);
    expect(Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('dawm_demo_')))).toEqual(live);
    expect(Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key !== 'dawm_demo_version'))).toEqual(session);
  }, 30_000);
});
it('keeps identity edits, tracking codes and user-created candidates editable across every mode', async () => {
  applyIntegrityDemoScenario('high', actor, true, 'Named practice roster');
  const first = getCandidates()[0];
  await updateCandidateDetails(first.id, { first_name: 'EditedName', tracking_code: 'TRK-EDITED' }, actor.id, actor.email);
  const created = await createCandidate({ ...first, first_name: 'NewName', tracking_code: 'TRK-NEW-DEMO', passport_number: 'NEW-PASSPORT', email: 'new@example.test' }, actor.id, actor.email);
  for (const scenario of INTEGRITY_DEMO_SCENARIOS) {
    applyIntegrityDemoScenario(scenario.id, actor, true, 'Switch without renaming');
    expect(getCandidates()).toHaveLength(436);
    expect(getCandidates().find(candidate => candidate.id === first.id)).toMatchObject({ first_name: 'EditedName', tracking_code: 'TRK-EDITED' });
    expect(getCandidates().find(candidate => candidate.id === created.id)).toMatchObject({ first_name: 'NewName', tracking_code: 'TRK-NEW-DEMO' });
    expect(getPayments().find(payment => payment.candidate_ids.includes(first.id))?.demo_evidence?.identities[0].tracking_code).toBe('TRK-EDITED');
  }
  await updateCandidateDetails(created.id, { last_name: 'EditableAfterSwitch' }, actor.id, actor.email);
  expect(getCandidates().find(candidate => candidate.id === created.id)?.last_name).toBe('EditableAfterSwitch');
}, 30000);
it('restores the previous demo mode after a storage failure instead of leaving partially switched evidence', () => {
  applyIntegrityDemoScenario('high', actor, true, 'Initial complete demo');
  const before = { ...localStorage };
  const original = Storage.prototype.setItem;
  let failed = false;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'dawm_demo_mock_payments' && !failed) { failed = true; throw new DOMException('Storage full', 'QuotaExceededError'); }
    return original.call(this, key, value);
  });
  try {
    expect(() => applyIntegrityDemoScenario('low', actor, true, 'Simulated storage failure')).toThrow('previous demo records were restored');
    expect({ ...localStorage }).toEqual(before);
    expect(getCandidates()).toHaveLength(435);
  } finally { spy.mockRestore(); }
});
