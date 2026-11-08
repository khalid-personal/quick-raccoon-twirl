import { DEMO_CANDIDATE_COUNT, generateDemoDataset, type DemoDataset } from './demo-dataset';
import { bootDemo, loadDemoData } from './demo-loader';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import { analyzeIntegrity, getIntegrityScoreLevel, riskScore, type IntegrityScoreLevel } from './integrity';
import { minimumPerCandidate, isForeignPayment } from './currency';
import { reconcile, type MatchStatus } from './bank-reconciliation';
import { loadBankStatement, loadReconciliationEvents, saveBankStatement, type BankStatement, type PaymentStatementSource, type ReconciliationCaseEvent } from './bank-statement-store';
import { getApprovalLogs, getCandidates, getCandidateStages, getConfig, getDocuments, getMedicalResults, getPayments, getPaymentStatuses, saveApprovalLogs, saveCandidates, saveCandidateStages, saveConfig, saveDocuments, saveMedicalResults, savePayments, savePaymentStatuses } from './data-store';
import { ALL_STAGES, type Candidate, type UserRole } from './types';
import { withDemoPaymentEvidence, withDemoStatementOriginal } from './demo-payment-evidence';
import { assignUnassignedStageTasks } from './staff-tasks';

export const INTEGRITY_DEMO_SCENARIOS = [
  { id: 'low', label: 'Low', risky: 12, start: 12, explanation: 'Several files have problems. Some bank slips show too little, too much, or no proof. Deployment is waiting.' },
  { id: 'low-medium', label: 'Low→Medium', risky: 5, start: 12, explanation: 'Many files were fixed. Some still need help. The folder is getting better, but it is not ready yet.' },
  { id: 'medium', label: 'Medium', risky: 4, start: 4, explanation: 'Most files look good. Some still have wrong payment details and a long wait.' },
  { id: 'medium-high', label: 'Medium→High', risky: 1, start: 4, explanation: 'Most flagged files were fixed. A few still need help. Most receipts now match the bank slips.' },
  { id: 'high-medium', label: 'High→Medium', risky: 3, start: 0, explanation: 'Some files developed problems. A once-clean folder now needs another check.' },
  { id: 'high', label: 'High', risky: 0, start: 0, explanation: 'Every receipt matches a pretend bank slip. Fees are paid. Deployment still waits for real ministry clearance.' },
] as const;
export type IntegrityDemoScenarioId = typeof INTEGRITY_DEMO_SCENARIOS[number]['id'];
export interface DemoScenarioActor { id: string; email: string; role: UserRole | null; authenticated: boolean }
export interface IntegrityDemoMeasurement {
  score: number;
  level: IntegrityScoreLevel;
  candidates: number;
  findings: number;
  documents: number;
  bank: Record<MatchStatus, number>;
}
type ScenarioEvidence = { agencyId: string; source: PaymentStatementSource; statement: BankStatement; events: ReconciliationCaseEvent[] };
export interface IntegrityDemoDataset extends DemoDataset { evidence: ScenarioEvidence[]; starting: IntegrityDemoMeasurement; measured: IntegrityDemoMeasurement }
const DAY = 86_400_000;
const COUNT = DEMO_CANDIDATE_COUNT;
const requireActor = (actor: DemoScenarioActor, confirmed: boolean, reason: string) => {
  if (!isDemoMode() || !actor.authenticated || actor.role !== 'superadmin' || !actor.id || !actor.email.trim()) {
    throw new Error('Only a signed-in superadmin can replace data in the DEMO sandbox.');
  }
  if (!confirmed || !reason.trim()) throw new Error('Confirm replacement and give a reason first.');
};
const measure = (data: Pick<DemoDataset, 'candidates' | 'stages' | 'medicals' | 'documents' | 'payments' | 'paymentStatuses' | 'logs'>,
  evidence: Pick<ScenarioEvidence, 'agencyId' | 'source' | 'statement'>[], stageFees: Record<number, number>,
  thresholds: { greenMin: number; yellowMin: number } | undefined, now: number): IntegrityDemoMeasurement => {
  const findings = analyzeIntegrity({ ...data, stageFees, now });
  const score = riskScore(findings, data.candidates.length);
  const bank: Record<MatchStatus, number> = { matched: 0, short: 0, over: 0, missing: 0, 'reference-mismatch': 0, 'currency-mismatch': 0 };
  evidence.forEach(item => reconcile(data.payments.filter(p => p.status === 'succeeded' && p.payee_local_agency_id === item.agencyId
    && isForeignPayment(p) === (item.source === 'foreign')), item.statement.lines).matches.forEach(match => bank[match.status]++));
  return { score, level: getIntegrityScoreLevel(score, thresholds), candidates: data.candidates.length, findings: findings.length, documents: data.documents.length, bank };
};

// No score or finding is injected: only synthetic candidate, receipt and bank records change.
export const buildIntegrityDemoScenario = (id: IntegrityDemoScenarioId, stageFees: Record<number, number>,
  thresholds?: { greenMin: number; yellowMin: number }, now = Date.now(), roster?: Candidate[]): IntegrityDemoDataset => {
  const scenario = INTEGRITY_DEMO_SCENARIOS.find(item => item.id === id);
  if (!scenario) throw new Error('Choose a listed DEMO scenario.');
  if (ALL_STAGES.some(stage => !Number.isFinite(stageFees[stage.id]) || stageFees[stage.id] <= 0)) {
    throw new Error('All four stage fees must be positive. DEMO scenarios never change your fees.');
  }
  const stamp = (days: number) => new Date(now - days * DAY).toISOString();
  const base = generateDemoDataset(now, 'high-performing');
  if (roster) base.candidates = base.candidates.map(candidate => roster.find(saved => saved.id === candidate.id) ?? candidate);
  const startingRisk = Math.round(scenario.start * COUNT / 120);
  const targetRisk = Math.round(scenario.risky * COUNT / 120);
  const caseLabel = (index: number, risky: number) => index < risky
    ? (index >= startingRisk ? 'DEMO regressing: new problems need help.' : 'DEMO still needs help.')
    : (index < startingRisk ? 'DEMO improving: payment details and bank proof repaired.' : 'DEMO checked: evidence matches.');
  const make = (risky: number) => {
    const data: DemoDataset = JSON.parse(JSON.stringify(base));
    data.candidates = data.candidates.slice(0, COUNT).map((candidate, index) => ({
      ...candidate, created_at: stamp(200),
      elmis: { status: index < risky ? 'mismatch' as const : 'verified' as const, checked_at: stamp(10), mode: 'sandbox' as const,
        registration_id: `DEMO-ELMIS-${index + 1}`, mismatches: index < risky ? ['DEMO: pretend registration details differ'] : [] },
      visa: { status: 'validated' as const, visa_number: `DEMO-VISA-${index + 1}`, mode: 'sandbox' as const,
        source: 'lookup' as const, expiry_date: new Date(now + 180 * DAY).toISOString().slice(0, 10),
        checked_at: stamp(10), sponsor_name: `DEMO Employer ${index + 1}`, occupation: candidate.occupation },
      arrival: undefined, flight: undefined, employment_history: undefined,
      contract_start_date: undefined, contract_end_date: undefined, expected_return_date: undefined, actual_return_date: undefined,
      return_status: 'not-planned' as const, payment_status: index < risky && index % 2 === 0 ? 'pending_payment' as const : 'paid' as const,
      external_status: { ...candidate.external_status, work_contract: true, visa: true, updated_at: stamp(10) },
      employer: { company: `DEMO Employer ${index + 1}`, contact_name: `DEMO Sponsor ${index + 1}`,
        phone: `+966500${String(index + 1).padStart(6, '0')}`, email: `demo-${index + 1}@employer.example.test`,
        address: `DEMO ${candidate.external_status?.destination_city}` },
      work_contract_record: { status: 'received' as const, sent_at: stamp(30), received_at: stamp(29),
        note: `DEMO synthetic contract. ${caseLabel(index, risky)} ${scenario.explanation}` },
      clearance: { local_ready_at: stamp(10),
        enjaz: { status: 'completed' as const, mode: 'sandbox' as const, reference: `DEMO-ENJAZ-${index + 1}`, updated_at: stamp(10) },
        tasheer: { status: 'completed' as const, mode: 'sandbox' as const, reference: `DEMO-TASHEER-${index + 1}`, updated_at: stamp(10) },
        labour_ministry: { status: 'pending' as const, mode: 'sandbox' as const, simulated: true,
        message: 'DEMO ONLY: pretend review pending. This is NOT official ministry clearance and cannot unlock deployment.' } },
    }));
    data.stages = data.candidates.flatMap((candidate, index) => ALL_STAGES.map((stage, order) => ({
      assigned_staff_id: base.stages.find(saved => saved.candidate_id === candidate.id && saved.stage_id === stage.id)?.assigned_staff_id,
      id: base.stages.find(saved => saved.candidate_id === candidate.id && saved.stage_id === stage.id)?.id ?? `demo-integrity-stage-${index}-${stage.id}`, candidate_id: candidate.id, stage_id: stage.id,
      status: stage.id === 4 ? 'In Progress' as const : 'Completed' as const,
      date: stage.id === 4 ? undefined : stamp(180 - order * 30),
      updated_at: stamp(index < risky && stage.id === 4 ? 150 : 10),
      follow_up_due_at: stage.id === 4 ? stamp(index < risky ? 2 : -1) : undefined,
      notes: `DEMO ${stage.title}. ${index < risky ? 'Review evidence.' : 'Evidence checked.'} No official clearance.`,
    })));
    data.stages = assignUnassignedStageTasks(data.candidates, data.stages, data.staffUsers);
    data.medicals = data.candidates.map(candidate => ({ id: `demo-integrity-medical-${candidate.id}`, candidate_id: candidate.id,
      exam_type: 'Final Agency Medical', status: 'Passed', exam_date: stamp(120).slice(0, 10), notes: 'DEMO synthetic passing result, not a real examination.' }));
    data.documents = data.candidates.flatMap(candidate => [
      { id: `demo-integrity-contract-${candidate.id}`, candidate_id: candidate.id, stage_id: 3, doc_kind: 'work_contract' as const,
        file_name: 'DEMO synthetic work contract.txt', file_type: 'text/plain', storage_key: `demo-integrity/${candidate.id}/contract`,
        uploaded_at: stamp(29), public_url: `data:text/plain,${encodeURIComponent(`DEMO ONLY. Synthetic work contract for ${candidate.first_name} ${candidate.last_name}. Employer: ${candidate.employer?.company}. Destination: ${candidate.external_status?.destination_country}. Not legally valid.`)}` },
      { id: `demo-integrity-visa-${candidate.id}`, candidate_id: candidate.id, stage_id: 4, doc_kind: 'visa' as const,
        file_name: 'DEMO synthetic visa.txt', file_type: 'text/plain', storage_key: `demo-integrity/${candidate.id}/visa`,
        uploaded_at: stamp(10), public_url: `data:text/plain,${encodeURIComponent(`DEMO ONLY. Synthetic visa ${candidate.visa?.visa_number}. This is not an official visa or permission to travel.`)}` },
    ]);
    data.payments = data.candidates.flatMap((candidate, index) => {
      const fees = ALL_STAGES.map((stage, order) => ({
        id: `demo-integrity-payment-${index}-${stage.id}`, stage_id: stage.id, provider: 'manual' as const,
        provider_reference: index < risky && stage.id === 2 ? '' : `DEMO-BANK-${index}-${stage.id}`,
        receipt_number: `DEMO-RECEIPT-${index}-${stage.id}`, payer_type: 'candidate' as const,
        payer_candidate_id: candidate.id, payer_foreign_agency_id: '', payee_local_agency_id: candidate.local_agency_id!,
        candidate_ids: [candidate.id], amount: stageFees[stage.id] * (index < risky && stage.id === 4 ? (index % 2 ? 1.5 : 0.5) : 1),
        currency: 'ETB', status: 'succeeded' as const, created_at: stamp(181 - order * 30), updated_at: stamp(10),
        payer_display_name: `${candidate.first_name} ${candidate.last_name}`,
      }));
      const minimum = minimumPerCandidate(candidate.external_status?.destination_country);
      if (!minimum) throw new Error(`Choose a supported contract destination for ${candidate.tracking_code} before generating demo foreign receipts.`);
      return [...fees, { id: `demo-integrity-foreign-${index}`, provider: 'manual' as const,
        provider_reference: `DEMO-FOREIGN-BANK-${index}`, receipt_number: `DEMO-FOREIGN-RECEIPT-${index}`,
        payer_type: 'foreign-agency' as const, contract_country: candidate.external_status?.destination_country,
        payer_foreign_agency_id: candidate.foreign_agency_id!, payee_local_agency_id: candidate.local_agency_id!,
        candidate_ids: [candidate.id], ...minimum, status: 'succeeded' as const, created_at: stamp(28), updated_at: stamp(10),
        payer_display_name: data.foreignAgencies.find(agency => agency.id === candidate.foreign_agency_id)?.name ?? 'Recorded foreign agency' }];
    });
    data.payments = data.payments.map(payment => withDemoPaymentEvidence(payment, data.candidates));
    data.paymentStatuses = data.candidates.flatMap((candidate, index) => ALL_STAGES.map(stage => ({
      candidateId: candidate.id, stageId: stage.id, isPaid: !(index < risky && index % 2 === 0 && stage.id === 4),
    })));
    data.candidates.forEach((candidate, index) => { candidate.last_payment_id = `demo-integrity-payment-${index}-4`; });
    data.logs = [];
    const riskyIds = new Set(data.candidates.slice(0, risky).map(candidate => candidate.id));
    const evidence: ScenarioEvidence[] = data.localAgencies.flatMap(agency => (['candidate', 'foreign'] as const).map(source => {
      const payments = data.payments.filter(p => p.payee_local_agency_id === agency.id && isForeignPayment(p) === (source === 'foreign'));
      const statement: BankStatement = withDemoStatementOriginal({ name: '', synthetic: true,
        covered_candidate_ids: data.candidates.filter(c => c.local_agency_id === agency.id).map(c => c.id),
        lines: payments.flatMap(payment => {
          const index = data.candidates.findIndex(candidate => candidate.id === payment.candidate_ids[0]);
          const bad = riskyIds.has(payment.candidate_ids[0]) && payment.stage_id === 4;
          if (bad && index % 3 === 2) return [];
          return [{ date: payment.created_at.slice(0, 10), description: `DEMO synthetic credit ${payment.id}, not real proof`,
            reference: payment.provider_reference || payment.receipt_number!, currency: payment.currency,
            amount: payment.amount * (bad ? (index % 3 === 0 ? 0.8 : 1.2) : 1) }];
        }) }, agency.name, source);
      const events: ReconciliationCaseEvent[] = reconcile(payments, statement.lines).matches.filter(match => match.status !== 'matched').map(match => ({
        id: `demo-integrity-evidence-${match.payment.id}`, caseId: match.payment.id, source, synthetic: true,
        action: 'request-evidence', actor: 'DEMO synthetic example, not a real operator', owner: `DEMO ${agency.name}`,
        note: `DEMO ONLY: please find the correct pretend bank slip. ${match.explanation}`, submissionStart: stamp(7).slice(0, 10),
        dueDate: stamp(2).slice(0, 10), createdAt: stamp(7),
        evidence: { payment: match.payment, statementName: statement.name, explanation: `DEMO ${match.explanation}` },
      }));
      return { agencyId: agency.id, source, statement, events };
    }));
    return { ...data, evidence };
  };
  const data = make(targetRisk);
  const startingData = startingRisk === targetRisk ? data : make(startingRisk);
  return { ...data, starting: measure(startingData, startingData.evidence, stageFees, thresholds, now),
    measured: measure(data, data.evidence, stageFees, thresholds, now) };
};

export const measureStoredIntegrityDemo = (now = Date.now()): IntegrityDemoMeasurement => {
  const data = { candidates: getCandidates(), stages: getCandidateStages(), medicals: getMedicalResults(), documents: getDocuments(),
    payments: getPayments(), paymentStatuses: getPaymentStatuses(), logs: getApprovalLogs() };
  const agencyIds = new Set(data.payments.map(payment => payment.payee_local_agency_id));
  const evidence = [...agencyIds].flatMap(agencyId => (['candidate', 'foreign'] as const).flatMap(source => {
    const statement = loadBankStatement(agencyId, source);
    return statement ? [{ agencyId, source, statement }] : [];
  }));
  const config = getConfig();
  return measure(data, evidence, config.stageFees ?? {}, config.integrityScoreThresholds, now);
};

export const applyIntegrityDemoScenario = (id: IntegrityDemoScenarioId, actor: DemoScenarioActor, confirmed: boolean, reason: string) => {
  requireActor(actor, confirmed, reason);
  bootDemo();
  bootDemo();
  const now = Date.now();
  const before = measureStoredIntegrityDemo(now);
  const config = getConfig();
  const data = buildIntegrityDemoScenario(id, config.stageFees ?? {}, config.integrityScoreThresholds, now, getCandidates());
  const ids = new Set(data.candidates.map(candidate => candidate.id));
  const extraCandidates = getCandidates().filter(candidate => !ids.has(candidate.id) && !candidate.id.startsWith('demo-integrity-candidate-'));
  const extraIds = new Set(extraCandidates.map(candidate => candidate.id));
  const retainedPayments = getPayments().filter(payment => !payment.id.startsWith('demo-') || payment.candidate_ids.some(id => extraIds.has(id)));
  const retainedStages = getCandidateStages().filter(stage => extraIds.has(stage.candidate_id));
  const retainedFlags = getPaymentStatuses().filter(flag => extraIds.has(flag.candidateId));
  const retainedMedical = getMedicalResults().filter(medical => !medical.id.startsWith('demo-') || extraIds.has(medical.candidate_id));
  const retainedDocuments = getDocuments().filter(document => !document.id.startsWith('demo-') || extraIds.has(document.candidate_id));
  const priorAudits = getApprovalLogs().filter(log => !log.id.startsWith('demo-') || log.target_id === 'demo-integrity-scenarios');
  if (data.evidence.some(item => { const existing = loadBankStatement(item.agencyId, item.source); return existing && !existing.synthetic; })) {
    throw new Error('An uploaded statement is present. Remove it explicitly or use a separate demo sandbox before replacing scenario bank evidence.');
  }
  const previous = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith(DEMO_KEY_PREFIX)));
  try {
    data.localAgencies.forEach(agency => {
      const history = loadReconciliationEvents(agency.id).filter(event => !event.id.startsWith('demo-evidence-') && !event.id.startsWith('demo-integrity-evidence-'));
      localStorage.setItem(`${DEMO_KEY_PREFIX}dawm_bank_statement:${agency.id}:cases`,
        JSON.stringify([...history, ...data.evidence.filter(item => item.agencyId === agency.id).flatMap(item => item.events.map(event => ({
          ...event, actor: actor.email, note: `${event.note} DEMO applied by ${actor.email}. Reason: ${reason.trim()}`,
        })))]));
    });
    data.evidence.forEach(item => saveBankStatement(item.agencyId, item.statement, item.source));
    saveCandidates([...data.candidates, ...extraCandidates]);
    savePayments([...data.payments, ...retainedPayments]);
    savePaymentStatuses([...data.paymentStatuses, ...retainedFlags]);
    saveCandidateStages([...data.stages, ...retainedStages]);
    saveMedicalResults([...data.medicals, ...retainedMedical]);
    saveDocuments([...data.documents, ...retainedDocuments]);
    saveApprovalLogs(priorAudits);
    const audit = { id: `demo-integrity-audit-${crypto.randomUUID()}`, actor_id: actor.id, actor_email: actor.email,
      timestamp: new Date(now).toISOString(), target_type: 'Config', target_id: 'demo-integrity-scenarios', action: 'Updated',
      description: `DEMO ONLY ${id}. Reason: ${reason.trim()}.` } as const;
    saveApprovalLogs([...priorAudits, audit]);
    const after = measureStoredIntegrityDemo(now);
    saveApprovalLogs([...priorAudits, { ...audit,
      description: `${audit.description} Measured before=${before.score}/${before.level}, after=${after.score}/${after.level}. Synthetic journey=${data.starting.score}→${data.measured.score}. Bank evidence=${JSON.stringify(after.bank)}. No live files or official clearance changed.` }]);
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    window.dispatchEvent(new CustomEvent('demo-scenario-changed'));
    sessionStorage.setItem('dawm_integrity_scenario', id);
    return { before, after, starting: data.starting };
  } catch (error) {
    Object.entries(localStorage).filter(([key, value]) => key.startsWith(DEMO_KEY_PREFIX) && previous.get(key) !== value).forEach(([key]) => localStorage.removeItem(key));
    previous.forEach((value, key) => { if (localStorage.getItem(key) !== value) localStorage.setItem(key, value); });
    window.dispatchEvent(new Event('supabase-data-changed'));
    throw new Error(`Could not switch demo mode; previous demo records were restored. ${error instanceof Error ? error.message : 'Browser storage failed.'}`);
  }
};

export const resetIntegrityDemoScenario = (actor: DemoScenarioActor, confirmed: boolean, reason: string) => {
  requireActor(actor, confirmed, reason);
  const before = measureStoredIntegrityDemo();
  const config = getConfig();
  const priorAudits = getApprovalLogs().filter(log => log.target_id === 'demo-integrity-scenarios');
  bootDemo();
  bootDemo();
  saveConfig(config);
  Object.keys(localStorage).filter(key => key.startsWith(`${DEMO_KEY_PREFIX}dawm_bank_statement:demo-`)
    || key.startsWith(`${DEMO_KEY_PREFIX}bank_evidence_initialized:demo-`)).forEach(key => localStorage.removeItem(key));
  loadDemoData();
  sessionStorage.removeItem('dawm_integrity_scenario');
  window.dispatchEvent(new CustomEvent('demo-scenario-changed'));
  const logs = getApprovalLogs().filter(log => log.target_id !== 'demo-integrity-scenarios');
  const audit = { id: `demo-integrity-audit-${crypto.randomUUID()}`,
    actor_id: actor.id, actor_email: actor.email, timestamp: new Date().toISOString(), target_type: 'Config',
    target_id: 'demo-integrity-scenarios', action: 'Updated',
    description: `DEMO ONLY reset using the demo loader. Reason: ${reason.trim()}.` } as const;
  saveApprovalLogs([...logs, ...priorAudits, audit]);
  const after = measureStoredIntegrityDemo();
  saveApprovalLogs([...logs, ...priorAudits, { ...audit, description: `${audit.description} Measured before=${before.score}/${before.level}, after=${after.score}/${after.level}.` }]);
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  return { before, after };
};
