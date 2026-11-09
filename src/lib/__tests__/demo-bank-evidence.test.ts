// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoBankEvidence, ensureDemoBankEvidence } from '../demo-bank-evidence';
import { generateDemoDataset } from '../demo-dataset';
import { loadBankStatement, loadReconciliationEvents, recordReconciliationEvent, saveBankStatement } from '../bank-statement-store';
import { reconcile } from '../bank-reconciliation';
import { isForeignPayment } from '../currency';
import { saveCandidates, saveLocalAgencies, savePayments, saveStaffUsers } from '../data-store';
import { getEvidenceRequests } from '../evidence-requests';
import { DEMO_KEY_PREFIX } from '../demo-mode';

const now = new Date('2026-11-07T12:00:00Z');
const demo = generateDemoDataset(now.getTime());
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('clearly labeled demo bank evidence', () => {
  it('covers every demo candidate in both agency statement sources', () => {
    const covered = new Set<string>();
    demo.localAgencies.forEach(agency => {
      const evidence = buildDemoBankEvidence(agency, demo.candidates, demo.payments, demo.staffUsers, now);
      expect(evidence.map(item => item.source)).toEqual(['candidate', 'foreign']);
      evidence.forEach(({ statement }) => {
        expect(statement.synthetic).toBe(true);
        expect(statement.name).toContain('DEMO / SYNTHETIC');
        expect(statement.covered_candidate_ids).toEqual(demo.candidates.filter(candidate => candidate.local_agency_id === agency.id).map(candidate => candidate.id));
        statement.covered_candidate_ids!.forEach(id => covered.add(id));
      });
    });
    expect(covered.size).toBe(demo.candidates.length);
  });
  it('includes shortages, overpayments, currency problems, and pending deadlines', () => {
    const statuses = new Set<string>();
    const requestStatuses = new Set<string>();
    demo.localAgencies.forEach(agency => buildDemoBankEvidence(agency, demo.candidates, demo.payments, demo.staffUsers, now).forEach(({ source, statement, events }) => {
      const payments = demo.payments.filter(payment => payment.payee_local_agency_id === agency.id && isForeignPayment(payment) === (source === 'foreign'));
      reconcile(payments, statement.lines).matches.forEach(match => statuses.add(match.status));
      getEvidenceRequests(events, now).forEach(request => requestStatuses.add(request.status));
      expect(events.every(event => event.synthetic && event.note.startsWith('DEMO /'))).toBe(true);
      if (source === 'foreign') expect(events.every(event => demo.staffUsers.some(person => person.role === 'staff' && person.is_approved && person.local_agency_id === agency.id && person.email === event.owner))).toBe(true);
    }));
    expect([...statuses]).toEqual(expect.arrayContaining(['matched', 'short', 'over', 'missing', 'currency-mismatch']));
    expect([...requestStatuses]).toEqual(expect.arrayContaining(['pending', 'due-soon', 'overdue']));
  });
  it('never fabricates deposits for pending, failed or refunded transfers', () => {
    const agency = demo.localAgencies[0];
    const payment = { ...demo.payments.find(item => item.payee_local_agency_id === agency.id)!, status: 'pending' as const };
    const evidence = buildDemoBankEvidence(agency, demo.candidates, [payment], demo.staffUsers, now);
    expect(evidence.flatMap(item => item.statement.lines)).toHaveLength(0);
    expect(evidence.flatMap(item => item.events).some(event => event.evidence.payment?.id === payment.id)).toBe(true);
  });
  it('is demo-only, repeatable, and does not overwrite uploaded statements or cases', () => {
    ensureDemoBankEvidence();
    expect(localStorage.length).toBe(0);
    sessionStorage.setItem('dawm_demo_session', '1');
    saveCandidates(demo.candidates); savePayments(demo.payments); saveLocalAgencies(demo.localAgencies); saveStaffUsers(demo.staffUsers);
    const agency = demo.localAgencies[0];
    saveBankStatement(agency.id, { name: 'User upload', lines: [] }, 'foreign');
    ensureDemoBankEvidence();
    expect(loadBankStatement(agency.id, 'foreign')?.name).toBe('User upload');
    expect(loadBankStatement(agency.id, 'candidate')?.synthetic).toBe(true);
    const cases = loadReconciliationEvents(agency.id);
    ensureDemoBankEvidence();
    expect(loadReconciliationEvents(agency.id)).toEqual(cases);
    sessionStorage.removeItem('dawm_demo_session');
    expect(loadBankStatement(agency.id)).toBeNull();
    expect(loadReconciliationEvents(agency.id)).toEqual([]);
  });
  it('updates untouched old statement owners without changing operator-owned requests or bank files', () => {
    sessionStorage.setItem('dawm_demo_session', '1');
    saveCandidates(demo.candidates); savePayments(demo.payments); saveLocalAgencies(demo.localAgencies); saveStaffUsers(demo.staffUsers);
    ensureDemoBankEvidence();
    const agency = demo.localAgencies[0], events = loadReconciliationEvents(agency.id);
    const requests = events.filter(event => event.source === 'foreign');
    expect(requests.length).toBeGreaterThan(1);
    const bank = loadBankStatement(agency.id, 'foreign');
    localStorage.setItem(`${DEMO_KEY_PREFIX}dawm_bank_statement:${agency.id}:cases`, JSON.stringify(events.map(event => ({ ...event, owner: 'old-manager@test.test' }))));
    const operator = recordReconciliationEvent(agency.id, { ...requests[1], actor: 'Operator reviewer', owner: 'chosen-owner@test.test', note: 'Keep this operator assignment' });
    ensureDemoBankEvidence();
    const updated = loadReconciliationEvents(agency.id);
    expect(updated.find(event => event.id === requests[0].id)?.owner).toBe(demo.staffUsers.find(person => person.role === 'staff' && person.is_approved && person.local_agency_id === agency.id)?.email);
    expect(updated.find(event => event.id === requests[1].id)?.owner).toBe('old-manager@test.test');
    expect(updated.find(event => event.id === operator.id)).toEqual(operator);
    expect(loadBankStatement(agency.id, 'foreign')).toEqual(bank);
  });
});
