// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiPrincipal } from '../api/auth';
import { decideIntegrityInvestigation, investigationEscalated } from '../integrity-investigations';
import { getApprovalLogs, getCandidates, getIntegrityOverrides, saveCandidates, saveCandidateStages, saveConfig, getConfig, savePayments, savePaymentStatuses, saveMedicalResults, saveDocuments } from '../data-store';
import { analyzeIntegrity, applyOverrides } from '../integrity';
import { generateDemoDataset } from '../demo-dataset';
import { buildIntegrityDemoScenario, INTEGRITY_DEMO_SCENARIOS } from '../demo-integrity-scenarios';

vi.mock('../api/auth', () => ({ getApiPrincipal: vi.fn() }));
const fees = { 1: 500, 3: 2200, 2: 2000, 4: 6000 };
const findings = () => analyzeIntegrity({ candidates: getCandidates(), stages: [], payments: [], paymentStatuses: [], medicals: [], logs: [] });
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  const candidates = generateDemoDataset().candidates.slice(0, 2);
  candidates[1].passport_number = candidates[0].passport_number;
  saveCandidates(candidates); saveCandidateStages([]); savePayments([]); savePaymentStatuses([]); saveMedicalResults([]); saveDocuments([]);
  saveConfig({ ...getConfig(), stageFees: fees });
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'demo-superadmin', role: 'superadmin', localAgencyId: null, foreignAgencyId: null });
});
describe('ministry investigation decisions', () => {
  it('escalates a real warning without closing it or altering the source, then closes with a retained audited reason', async () => {
    const finding = findings().find(finding => finding.rule === 'duplicate-passport')!;
    const before = getCandidates();
    await decideIntegrityInvestigation(finding, 'escalate', 'Check the original passports and ministry registration evidence');
    expect(investigationEscalated(finding.id)).toBe(true);
    expect(getIntegrityOverrides()).toHaveLength(0);
    expect(getCandidates()).toEqual(before);
    expect(getApprovalLogs().some(log => log.target_id === `integrity-investigation:${finding.id}`)).toBe(true);
    await decideIntegrityInvestigation(finding, 'close', 'Reviewed original documents; shared number was an approved practice exception');
    expect(applyOverrides(findings(), getIntegrityOverrides()).active.some(item => item.id === finding.id)).toBe(false);
    expect(getIntegrityOverrides()[0].reason).toContain('Reviewed original documents');
    expect(getCandidates()).toEqual(before);
  });
  it('rejects insufficient reasons, changed evidence and non-superadmin callers', async () => {
    const finding = findings().find(finding => finding.rule === 'duplicate-passport')!;
    await expect(decideIntegrityInvestigation(finding, 'close', 'Fine')).rejects.toThrow('15 characters');
    const candidates = getCandidates(); candidates[1].passport_number = 'UNIQUE-NEW-PASSPORT'; saveCandidates(candidates);
    await expect(decideIntegrityInvestigation(finding, 'escalate', 'This evidence must be checked by the ministry')).rejects.toThrow('Reload');
    vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'manager', role: 'local-agency', localAgencyId: 'local', foreignAgencyId: null });
    await expect(decideIntegrityInvestigation(finding, 'close', 'This evidence must be checked by the ministry')).rejects.toThrow('superadmin');
    expect(getIntegrityOverrides()).toHaveLength(0);
  });
  it('generates real suspicious payment-edit histories in non-High scenarios, without injecting flags into High', () => {
    for (const scenario of INTEGRITY_DEMO_SCENARIOS) {
      const data = buildIntegrityDemoScenario(scenario.id, fees, undefined, Date.parse('2026-11-08T12:00:00Z'));
      const suspicious = analyzeIntegrity({ ...data, stageFees: fees, now: Date.parse('2026-11-08T12:00:00Z') }).filter(finding => finding.rule === 'payment-edits');
      const actors = new Set(data.logs.filter(log => log.id.startsWith('demo-integrity-suspicious')).map(log => log.actor_email));
      expect(suspicious.filter(finding => actors.has(finding.actor!)).length).toBe(scenario.id === 'high' ? 0 : scenario.id === 'low' ? 3 : scenario.id === 'low-medium' ? 2 : 1);
      data.logs.filter(log => log.id.startsWith('demo-integrity-suspicious')).forEach(log => {
        expect(log.description).toContain('DEMO ONLY');
        const payment = data.payments.find(payment => payment.id === log.target_id)!;
        expect(log.description).toContain(payment.provider_reference);
        expect(log.description).toContain(`${payment.amount} ${payment.currency}`);
      });
    }
  }, 120000);
});
