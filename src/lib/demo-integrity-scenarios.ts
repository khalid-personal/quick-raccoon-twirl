import { DEMO_CANDIDATE_COUNT, generateDemoDataset, demoMedicalLocationFor, demoStageLocationFor, type DemoDataset } from './demo-dataset';
import { bootDemo, loadDemoData } from './demo-loader';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import { analyzeIntegrity, getIntegrityScoreLevel, riskScore, type IntegrityScoreLevel } from './integrity';
import { minimumPerCandidate, isForeignPayment } from './currency';
import { reconcile, type MatchStatus } from './bank-reconciliation';
import { loadBankStatement, loadReconciliationEvents, saveBankStatement, type BankStatement, type PaymentStatementSource, type ReconciliationCaseEvent } from './bank-statement-store';
import { getApprovalLogs, getCandidates, getCandidateStages, getConfig, getDocuments, getMedicalResults, getPayments, getPaymentStatuses, saveApprovalLogs, saveCandidates, saveCandidateStages, saveConfig, saveDocuments, saveMedicalResults, savePayments, savePaymentStatuses } from './data-store';
import { ALL_STAGES, type Candidate, type CandidateStage, type UserRole } from './types';
import { withDemoPaymentEvidence, withDemoStatementOriginal } from './demo-payment-evidence';
import { assignUnassignedStageTasks, getActiveStageTasks } from './staff-tasks';
import { amountDiscrepancies, escalateAmountDiscrepancy, getAgencyResolutionCases, type AgencyResolutionCase } from './agency-resolution';
import { demoAgencyManager, paymentCandidateSummary } from './demo-identities';
import { LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_DOCUMENTS, LS_MEDICAL_RESULTS, LS_PAYMENTS, LS_PAYMENT_STATUS, LS_APPROVAL_LOGS } from './data-keys';
import { stageIsComplete, stageProgressBlockers } from './stage-readiness';
import { airportForCity } from './airports';
import { backtrackDemoAgencyTimelines } from './demo-agency-timeline';

export const INTEGRITY_DEMO_SCENARIOS = [
  { id: 'low', label: 'Low', risky: 12, start: 12, explanation: 'Very few deployments. Work is overdue, three foreign agencies are paused by ministry decision and two appeals await review.' },
  { id: 'low-medium', label: 'Low→Medium', risky: 5, start: 12, explanation: 'Collections and training are improving, but most files remain unfinished and the backlog is still large.' },
  { id: 'medium', label: 'Medium', risky: 4, start: 4, explanation: 'Steady progress across all stages, some deployments, and a manageable but visible payment and task backlog.' },
  { id: 'medium-high', label: 'Medium→High', risky: 1, start: 4, explanation: 'Most files deployed, fees mostly collected and almost all tasks on time. A few remaining issues need attention.' },
  { id: 'high-medium', label: 'High→Medium', risky: 3, start: 0, explanation: 'A previously healthy pipeline is slowing: fewer deployments, delayed collections and a growing task backlog.' },
  { id: 'high', label: 'High', risky: 0, start: 0, explanation: 'Most files deployed with all fees collected. Recent ministry intake is on time, tasks are caught up, and bank evidence matches.' },
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
  flaggedPayments: number;
  openPaymentCases: number;
  openAgencyCases: number;
  deployed: number;
  returned: number;
  activeTasks: number;
  overdueTasks: number;
}
type ScenarioEvidence = { agencyId: string; source: PaymentStatementSource; statement: BankStatement; events: ReconciliationCaseEvent[] };
export interface IntegrityDemoDataset extends DemoDataset { evidence: ScenarioEvidence[]; agencyCases: AgencyResolutionCase[]; starting: IntegrityDemoMeasurement; measured: IntegrityDemoMeasurement }
const DAY = 86_400_000;
const COUNT = DEMO_CANDIDATE_COUNT;
const requireActor = (actor: DemoScenarioActor, confirmed: boolean, reason: string) => {
  if (!isDemoMode() || !actor.authenticated || actor.role !== 'superadmin' || !actor.id || !actor.email.trim()) {
    throw new Error('Only a signed-in superadmin can replace data in the DEMO sandbox.');
  }
  if (!confirmed || !reason.trim()) throw new Error('Confirm replacement and give a reason first.');
};
const measure = (data: Pick<DemoDataset, 'candidates' | 'stages' | 'medicals' | 'documents' | 'payments' | 'paymentStatuses' | 'logs'>,
  evidence: Pick<ScenarioEvidence, 'agencyId' | 'source' | 'statement' | 'events'>[], stageFees: Record<number, number>,
  thresholds: { greenMin: number; yellowMin: number } | undefined, now: number): IntegrityDemoMeasurement => {
  const findings = analyzeIntegrity({ ...data, stageFees, now });
  const score = riskScore(findings, data.candidates.length);
  const bank: Record<MatchStatus, number> = { matched: 0, short: 0, over: 0, missing: 0, 'reference-mismatch': 0, 'currency-mismatch': 0 };
  evidence.forEach(item => reconcile(data.payments.filter(p => p.status === 'succeeded' && p.payee_local_agency_id === item.agencyId
    && isForeignPayment(p) === (item.source === 'foreign')), item.statement.lines).matches.forEach(match => bank[match.status]++));
  const latest = new Map(evidence.flatMap(item => item.events).map(event => [event.caseId, event]));
  const tasks = getActiveStageTasks(data.candidates, data.stages, now, { fees: stageFees, statuses: data.paymentStatuses, payments: data.payments });
  const deploymentIds = new Set(data.stages.filter(stage => stage.stage_id === 4 && stageIsComplete(stage.status)).map(stage => stage.candidate_id));
  return { score, level: getIntegrityScoreLevel(score, thresholds), candidates: data.candidates.length, findings: findings.length, documents: data.documents.length, bank,
    deployed: data.candidates.filter(candidate => deploymentIds.has(candidate.id)).length,
    returned: data.candidates.filter(candidate => candidate.return_status === 'returned').length,
    activeTasks: tasks.length, overdueTasks: tasks.filter(task => task.overdue).length,
    flaggedPayments: Object.entries(bank).reduce((total, [status, count]) => total + (status === 'matched' ? 0 : count), 0),
    openPaymentCases: [...latest.values()].filter(event => event.action !== 'resolve').length, openAgencyCases: 0 };
};

// No score or finding is injected: only synthetic candidate, receipt and bank records change.
export const buildIntegrityDemoScenario = (id: IntegrityDemoScenarioId, stageFees: Record<number, number>,
  thresholds?: { greenMin: number; yellowMin: number }, now = Date.now(), roster?: Candidate[], savedStages?: CandidateStage[]): IntegrityDemoDataset => {
  const scenario = INTEGRITY_DEMO_SCENARIOS.find(item => item.id === id);
  if (!scenario) throw new Error('Choose a listed DEMO scenario.');
  if (ALL_STAGES.some(stage => !Number.isFinite(stageFees[stage.id]) || stageFees[stage.id] <= 0)) {
    throw new Error('All four stage fees must be positive. DEMO scenarios never change your fees.');
  }
  const stamp = (days: number) => new Date(now - days * DAY).toISOString();
  const base = generateDemoDataset(now, 'high-performing');
  const assignments = new Map((savedStages ?? base.stages).map(stage => [`${stage.candidate_id}:${stage.stage_id}`, stage]));
  if (roster) base.candidates = base.candidates.map(candidate => roster.find(saved => saved.id === candidate.id) ?? candidate);
  const startingRisk = Math.round(scenario.start * COUNT / 120);
  const targetRisk = Math.round(scenario.risky * COUNT / 120);
  const caseLabel = (index: number, risky: number) => index < risky
    ? (index >= startingRisk ? 'DEMO regressing: new problems need help.' : 'DEMO still needs help.')
    : (index < startingRisk ? 'DEMO improving: payment details and bank proof repaired.' : 'DEMO checked: evidence matches.');
  const boundaries: Record<IntegrityDemoScenarioId, number[]> = {
    low: [75, 89, 96, 99], 'low-medium': [50, 73, 88, 95], medium: [30, 51, 70, 82],
    'medium-high': [10, 18, 27, 40], 'high-medium': [18, 32, 48, 65], high: [6, 8, 10, 14],
  };
  const pace = {
    low: { gap: 30, age: 45, unpaid: 80, overdue: 80 },
    'low-medium': { gap: 18, age: 25, unpaid: 45, overdue: 55 },
    medium: { gap: 12, age: 12, unpaid: 30, overdue: 30 },
    'high-medium': { gap: 10, age: 10, unpaid: 18, overdue: 20 },
    'medium-high': { gap: 7, age: 5, unpaid: 5, overdue: 5 },
    high: { gap: 5, age: 2, unpaid: 0, overdue: 0 },
  }[id];
  // Stable roster positions spread even the flagged files across the ordered pipeline.
  const currentOrder = (index: number) => {
    const order = boundaries[id].filter(limit => (index * 37) % 100 >= limit).length;
    return order === 4 && index < Math.max(startingRisk, targetRisk) ? 3 : order;
  };
  const returned = (index: number) => currentOrder(index) === 4 && index % 20 === 19;
  const currentPaid = (index: number, risky: number) => currentOrder(index) === 4 || index >= risky && (index * 53) % 100 >= pace.unpaid;
  const stageAge = (index: number, risky: number) => returned(index) ? 730 : index < risky ? 150 : pace.age + index % 3;
  const completedAge = (index: number, order: number, risky: number) => stageAge(index, risky) + (currentOrder(index) - order - 1) * pace.gap;
  const make = (risky: number) => {
    const data: DemoDataset = JSON.parse(JSON.stringify(base));
    data.candidates = data.candidates.slice(0, COUNT).map((candidate, index) => ({
      ...candidate, created_at: stamp(stageAge(index, risky) + currentOrder(index) * pace.gap + 2),
      updated_at: stamp(stageAge(index, risky)), last_synced_at: stamp(1),
      elmis: { status: index < risky ? 'mismatch' as const : 'verified' as const, checked_at: stamp(10), mode: 'sandbox' as const,
        registration_id: `DEMO-ELMIS-${index + 1}`, mismatches: index < risky ? ['DEMO: pretend registration details differ'] : [] },
      visa: currentOrder(index) >= 3 ? { status: 'validated' as const, visa_number: `DEMO-VISA-${index + 1}`, mode: 'sandbox' as const,
        source: 'lookup' as const, expiry_date: new Date(now + 180 * DAY).toISOString().slice(0, 10),
        checked_at: stamp(10), sponsor_name: `DEMO Employer ${index + 1}`, occupation: candidate.occupation } : undefined,
      arrival: currentOrder(index) === 4 ? { arrived_at: stamp(stageAge(index, risky) - 1), confirmed_by: 'candidate' as const, note: 'DEMO historical arrival, not travel authorization.' } : undefined,
      flight: currentOrder(index) === 4 ? { ...candidate.flight, flight_number: `ET${300 + index}`, departure_airport: 'ADD',
        arrival_airport: airportForCity(candidate.external_status?.destination_city)?.code ?? '', departure_time: stamp(stageAge(index, risky)),
        note: 'DEMO historical flight, not a live booking.' } : undefined,
      employment_history: returned(index) ? [{
        home_city: candidate.home_city ?? '', coc_facility_id: candidate.coc_facility_id ?? '',
        destination_city: candidate.external_status?.destination_city ?? '', destination_country: candidate.external_status?.destination_country ?? '',
        departed_at: stamp(stageAge(index, risky)), contract_completed_at: stamp(2), returned_at: stamp(1),
        employer_name: `DEMO Employer ${index + 1}`, contract_reference: `DEMO-CONTRACT-${index + 1}`,
      }] : undefined,
      contract_start_date: currentOrder(index) === 4 ? stamp(stageAge(index, risky) - 1).slice(0, 10) : undefined,
      contract_end_date: returned(index) ? stamp(2).slice(0, 10) : undefined,
      expected_return_date: currentOrder(index) === 4 ? stamp(returned(index) ? 1 : -700).slice(0, 10) : undefined,
      actual_return_date: returned(index) ? stamp(1).slice(0, 10) : undefined,
      return_status: returned(index) ? 'returned' as const : 'not-planned' as const, payment_status: currentPaid(index, risky) ? 'paid' as const : 'pending_payment' as const,
      external_status: { ...candidate.external_status, work_contract: currentOrder(index) >= 1, visa: currentOrder(index) >= 3, updated_at: stamp(1) },
      employer: { company: `DEMO Employer ${index + 1}`, contact_name: `DEMO Sponsor ${index + 1}`,
        phone: `+966500${String(index + 1).padStart(6, '0')}`, email: `demo-${index + 1}@employer.example.test`,
        address: `DEMO ${candidate.external_status?.destination_city}` },
      work_contract_record: { status: currentOrder(index) >= 1 ? 'received' as const : 'not-sent' as const,
        sent_at: currentOrder(index) >= 1 ? stamp(stageAge(index, risky) + (currentOrder(index) - 1) * pace.gap) : undefined,
        received_at: currentOrder(index) >= 1 ? stamp(stageAge(index, risky) + (currentOrder(index) - 1) * pace.gap - 1) : undefined,
        note: `DEMO synthetic contract. ${caseLabel(index, risky)}` },
      clearance: { local_ready_at: currentOrder(index) >= 3 ? stamp(stageAge(index, risky) + 1) : undefined,
        enjaz: { status: currentOrder(index) >= 3 ? 'completed' as const : 'pending' as const, mode: 'sandbox' as const, updated_at: stamp(stageAge(index, risky) + 1) },
        tasheer: { status: currentOrder(index) >= 3 ? 'completed' as const : 'pending' as const, mode: 'sandbox' as const, updated_at: stamp(stageAge(index, risky) + 1) },
        labour_ministry: { status: currentOrder(index) === 4 ? 'cleared' as const : 'pending' as const, mode: 'sandbox' as const, simulated: true,
        message: 'Practice ministry status.' } },
    }));
    data.stages = data.candidates.flatMap((candidate, index) => ALL_STAGES.map((stage, order) => ({
      assigned_staff_id: assignments.get(`${candidate.id}:${stage.id}`)?.assigned_staff_id,
      foreign_assigned_staff_id: assignments.get(`${candidate.id}:${stage.id}`)?.foreign_assigned_staff_id,
      id: base.stages.find(saved => saved.candidate_id === candidate.id && saved.stage_id === stage.id)?.id ?? `demo-integrity-stage-${index}-${stage.id}`, candidate_id: candidate.id, stage_id: stage.id,
      status: order < currentOrder(index) ? 'Completed' as const : order > currentOrder(index) ? 'Pending' as const
        : index < risky ? 'In Progress' as const
        : stage.id === 2 && index % 11 === 0 && currentPaid(index, risky) && id !== 'high' ? 'Failed' as const
        : currentPaid(index, risky) ? 'In Progress' as const : 'Pending' as const,
      date: order < currentOrder(index) ? stamp(completedAge(index, order, risky)) : undefined,
      updated_at: stamp(order < currentOrder(index) ? completedAge(index, order, risky) : stageAge(index, risky)),
      follow_up_due_at: order === currentOrder(index) ? stamp(index < risky || (index * 61) % 100 < pace.overdue ? 2 : -3) : undefined,
      notes: `DEMO ${stage.title}. ${index < risky ? 'Review.' : 'Checked.'}`,
    })));
    data.stages = assignUnassignedStageTasks(data.candidates, data.stages, data.staffUsers);
    data.medicals = data.candidates.flatMap((candidate, index) => {
      if (currentOrder(index) < 2) return [];
      const failed = data.stages.some(stage => stage.candidate_id === candidate.id && stage.stage_id === 2 && stage.status === 'Failed');
      return (candidate.gender === 'male' ? ['HIV', 'Final Agency Medical'] : ['HIV', 'Pregnancy', 'Final Agency Medical']).map(exam => ({
        id: `demo-integrity-medical-${candidate.id}-${exam}`, candidate_id: candidate.id,
        exam_type: exam, status: currentOrder(index) >= 3 ? 'Passed' as const
          : failed && exam === 'Final Agency Medical' ? 'Failed' as const : 'Pending' as const,
        exam_date: currentOrder(index) >= 3 || (failed && exam === 'Final Agency Medical') ? stamp(stageAge(index, risky) + pace.gap).slice(0, 10) : undefined,
        notes: 'DEMO examination record.',
        location: currentOrder(index) >= 3 || (failed && exam === 'Final Agency Medical') ? demoMedicalLocationFor(candidate.id) : undefined,
      }));
    });
    data.documents = data.candidates.flatMap((candidate, index) => [
      { id: `demo-integrity-contract-${candidate.id}`, candidate_id: candidate.id, stage_id: 3, doc_kind: 'work_contract' as const,
        file_name: 'DEMO synthetic work contract.txt', file_type: 'text/plain', storage_key: `demo-integrity/${candidate.id}/contract`,
        uploaded_at: candidate.work_contract_record?.received_at ?? stamp(1), public_url: `data:text/plain,${encodeURIComponent(`DEMO ONLY. Synthetic work contract for ${candidate.first_name} ${candidate.last_name}. Employer: ${candidate.employer?.company}. Destination: ${candidate.external_status?.destination_country}. Not legally valid.`)}` },
      { id: `demo-integrity-visa-${candidate.id}`, candidate_id: candidate.id, stage_id: 4, doc_kind: 'visa' as const,
        file_name: 'DEMO synthetic visa.txt', file_type: 'text/plain', storage_key: `demo-integrity/${candidate.id}/visa`,
        uploaded_at: stamp(stageAge(index, risky) + 1), public_url: `data:text/plain,${encodeURIComponent(`DEMO ONLY. Synthetic visa ${candidate.visa?.visa_number}. This is not an official visa or permission to travel.`)}` },
    ].filter(document => document.stage_id === 3 ? currentOrder(index) >= 1 : currentOrder(index) >= 3));
    data.payments = data.candidates.flatMap((candidate, index) => {
      const fees = ALL_STAGES.map((stage, order) => ({
        id: `demo-integrity-payment-${index}-${stage.id}`, stage_id: stage.id, provider: 'chechepay' as const,
        provider_reference: `DEMO-CHECHEPAY-${index}-${stage.id}`,
        receipt_number: `DEMO-RECEIPT-${index}-${stage.id}`, payer_type: 'candidate' as const,
        payer_candidate_id: candidate.id, payer_foreign_agency_id: '', payee_local_agency_id: candidate.local_agency_id!,
        candidate_ids: [candidate.id], amount: stageFees[stage.id],
        currency: 'ETB', status: index < risky && order === currentOrder(index) ? index % 2 ? 'failed' as const : 'timed-out' as const : 'succeeded' as const,
        created_at: stamp(order < currentOrder(index) ? completedAge(index, order, risky) + 1 : stageAge(index, risky)), updated_at: stamp(1),
        payer_display_name: `${candidate.first_name} ${candidate.last_name}`,
      })).filter((payment, order) => order < currentOrder(index) || (order === currentOrder(index) && (index < risky || currentPaid(index, risky))));
      const minimum = minimumPerCandidate(candidate.external_status?.destination_country);
      if (!minimum) throw new Error(`Choose a supported contract destination for ${candidate.tracking_code} before generating demo foreign receipts.`);
      return [...fees, ...(currentOrder(index) >= 2 ? [{ id: `demo-integrity-foreign-${index}`, provider: 'manual' as const,
        provider_reference: `DEMO-FOREIGN-BANK-${index}`, receipt_number: `DEMO-FOREIGN-RECEIPT-${index}`,
        payer_type: 'foreign-agency' as const, contract_country: candidate.external_status?.destination_country,
        payer_foreign_agency_id: candidate.foreign_agency_id!, payee_local_agency_id: candidate.local_agency_id!,
        candidate_ids: [candidate.id], ...minimum, status: 'succeeded' as const,
        created_at: stamp(stageAge(index, risky) + (currentOrder(index) - 1) * pace.gap - 2), updated_at: stamp(1),
        payer_display_name: data.foreignAgencies.find(agency => agency.id === candidate.foreign_agency_id)?.name ?? 'Recorded foreign agency' }] : [])];
    });
    data.paymentStatuses = data.candidates.flatMap((candidate, index) => ALL_STAGES.map((stage, order) => ({
      candidateId: candidate.id, stageId: stage.id, isPaid: order < currentOrder(index) || (order === currentOrder(index) && currentPaid(index, risky)),
    })));
    const pauses = new Map(id === 'low' ? data.foreignAgencies.slice(0, 3).map(agency => [agency.id, stamp(2)] as const) : []);
    backtrackDemoAgencyTimelines(data, pauses, stageFees);
    data.payments = data.payments.map(payment => withDemoPaymentEvidence({
      ...payment,
      initiated_by: { id: payment.payer_candidate_id ?? demoAgencyManager(payment.payer_foreign_agency_id)!.id },
      recorded_by: { id: demoAgencyManager(payment.payee_local_agency_id)!.id },
    }, data.candidates));
    data.candidates.forEach(candidate => {
      candidate.last_payment_id = data.payments.filter(payment => payment.payer_candidate_id === candidate.id).at(-1)?.id;
      data.stages.filter(stage => stage.candidate_id === candidate.id).forEach(stage => {
        const blockers = stageProgressBlockers(candidate, stage.stage_id, stage.status, data.stages, stageFees, data.paymentStatuses, data.payments);
        if (blockers.length) throw new Error(`Invalid DEMO stage sequence: ${blockers.join(' ')}`);
      });
    });
    data.logs = [];
    const suspiciousGroups = Math.min(3, Math.ceil(risky / 15));
    for (const agency of data.localAgencies.slice(0, suspiciousGroups)) {
      const manager = demoAgencyManager(agency.id);
      const payment = data.payments.find(payment => isForeignPayment(payment) && payment.payee_local_agency_id === agency.id);
      if (!manager?.id || !manager.email || !payment) throw new Error(`DEMO investigation requires a recorded agency manager and transfer for ${agency.id}.`);
      data.logs.push(...[0, 1, 2].map(index => ({
        id: `demo-integrity-suspicious-edit-${agency.id}-${index}`, actor_id: manager.id, actor_email: manager.email!,
        timestamp: new Date(Date.parse(payment.created_at) + (index + 1) * 60_000).toISOString(),
        target_type: 'Payment' as const, target_id: payment.id, action: 'Updated' as const,
        description: `DEMO ONLY suspicious-activity practice: repeated payment-record correction ${index + 1}. Check the original candidate, ${payment.provider_reference}, ${payment.amount} ${payment.currency} against bank evidence. No live receipt was edited; this synthetic history requires investigation, not a finding of fraud.`,
      })));
    }
    const foreignRisk = new Map(data.payments.filter(isForeignPayment).slice(0, risky).map((payment, index) => [payment.id, index]));
    const evidence: ScenarioEvidence[] = data.localAgencies.flatMap(agency => (['candidate', 'foreign'] as const).map(source => {
      const payments = data.payments.filter(p => p.status === 'succeeded' && p.payee_local_agency_id === agency.id && isForeignPayment(p) === (source === 'foreign'));
      const statement: BankStatement = withDemoStatementOriginal({ name: '', synthetic: true,
        covered_candidate_ids: data.candidates.filter(c => c.local_agency_id === agency.id).map(c => c.id),
        lines: payments.flatMap(payment => {
          const foreignIndex = foreignRisk.get(payment.id);
          const riskIndex = foreignIndex ?? 0;
          const bad = source === 'foreign' && foreignIndex !== undefined;
          if (bad && riskIndex % 3 === 2) return [];
          return [{ date: payment.created_at.slice(0, 10), description: `Practice / synthetic credit for ${paymentCandidateSummary(payment, data.candidates)}; ${agency.name}; not real bank proof`,
            reference: payment.provider_reference || payment.receipt_number!, currency: payment.currency,
            amount: payment.amount * (bad ? (riskIndex % 3 === 0 ? 0.8 : 1.2) : 1) }];
        }) }, agency.name, source);
      const events: ReconciliationCaseEvent[] = reconcile(payments, statement.lines).matches.filter(match => match.status !== 'matched').map(match => ({
        id: `demo-integrity-evidence-${match.payment.id}`, caseId: match.payment.id, source, synthetic: true,
        action: 'request-evidence', actor: 'DEMO synthetic example, not a real operator',
        owner: data.staffUsers.find(person => person.role === 'staff' && person.is_approved && person.local_agency_id === agency.id)?.email ?? demoAgencyManager(agency.id)!.email!,
        note: `DEMO ONLY: please find the correct pretend bank slip. ${match.explanation}`, submissionStart: stamp(7).slice(0, 10),
        dueDate: stamp(2).slice(0, 10), createdAt: stamp(7),
        evidence: { payment: match.payment, statementName: statement.name, explanation: `DEMO ${match.explanation}` },
      }));
      return { agencyId: agency.id, source, statement, events };
    }));
    const agencyCases: AgencyResolutionCase[] = [];
    for (const [agencyId, pausedAt] of pauses) {
      const match = evidence.filter(item => item.source === 'foreign').flatMap(item =>
        reconcile(data.payments.filter(payment => isForeignPayment(payment) && payment.payee_local_agency_id === item.agencyId), item.statement.lines).matches
          .map(match => ({ ...match, recipientId: item.agencyId })))
        .find(match => match.status === 'short' && match.payment.payer_foreign_agency_id === agencyId && match.line);
      if (!match?.line) throw new Error(`Low DEMO needs a candidate-linked bank shortfall for paused agency ${agencyId}.`);
      const index = agencyCases.length;
      const manager = demoAgencyManager(agencyId);
      if (!manager?.id || !manager.email) throw new Error(`DEMO agency manager is missing for ${agencyId}.`);
      const caseId = `demo-integrity-paused-${agencyId}`;
      const createdAt = stamp(7);
      const dueDate = stamp(3).slice(0, 10);
      const events: AgencyResolutionCase['events'] = [
        { id: `${caseId}-opened`, action: 'escalated', reason: `${generatedCaseReason} A single synthetic candidate transfer needs a reply before ${dueDate}.`,
          actorId: 'demo-ministry-reviewer', actor: 'DEMO ministry reviewer', at: createdAt, auditId: `${caseId}-audit-opened` },
        { id: `${caseId}-paused`, action: 'suspend', reason: `${generatedCaseReason} Ministry explicitly paused this agency after its reply deadline for this one verified candidate-linked shortfall. This is not an automatic third-strike decision.`,
          actorId: 'demo-ministry-reviewer', actor: 'DEMO ministry reviewer', at: pausedAt, auditId: `${caseId}-audit-paused` },
      ];
      if (index > 0) events.push({ id: `${caseId}-appeal`, action: 'appeal',
        reason: `${generatedCaseReason} ${index === 1 ? 'We ask the ministry to review the bank allocation for this candidate.' : 'We acknowledge the shortfall and request review of our proposed correction.'} The agency stays paused until an explicit decision.`,
        actorId: manager.id, actor: manager.email, at: stamp(1), auditId: `${caseId}-audit-appeal` });
      const record: AgencyResolutionCase = { id: caseId, issue: {
        id: `bank:${match.payment.id}`, caseId: match.payment.id, paymentId: match.payment.id, recipientId: match.recipientId,
        source: 'foreign', agencyId, agencyType: 'foreign', kind: 'underpayment', basis: 'bank',
        explanation: `${match.explanation} DEMO: one candidate transfer, one explicit ministry pause.`,
        snapshot: JSON.stringify({ payment: match.payment, line: match.line }),
      }, state: index > 0 ? 'appealed' : 'suspended', holdActive: true, dueDate, createdAt, updatedAt: events.at(-1)!.at, events };
      agencyCases.push(record);
      data.logs.push(...events.map(event => ({ id: event.auditId, actor_id: event.actorId, actor_email: event.actor, timestamp: event.at,
        target_type: 'Payment' as const, target_id: match.payment.id, action: 'Updated' as const, description: event.reason })));
    }
    data.stages = data.stages.map(stage => ({ ...stage, location: demoStageLocationFor(data.candidates.find(candidate => candidate.id === stage.candidate_id)!, stage, data.cocFacilities) }));
    return { ...data, evidence, agencyCases };
  };
  const data = make(targetRisk);
  const startingData = startingRisk === targetRisk ? data : make(startingRisk);
  return { ...data, starting: { ...measure(startingData, startingData.evidence, stageFees, thresholds, now), openAgencyCases: startingData.agencyCases.length },
    measured: { ...measure(data, data.evidence, stageFees, thresholds, now), openAgencyCases: data.agencyCases.length } };
};

export const measureStoredIntegrityDemo = (now = Date.now()): IntegrityDemoMeasurement => {
  const data = { candidates: getCandidates(), stages: getCandidateStages(), medicals: getMedicalResults(), documents: getDocuments(),
    payments: getPayments(), paymentStatuses: getPaymentStatuses(), logs: getApprovalLogs() };
  const agencyIds = new Set(data.payments.map(payment => payment.payee_local_agency_id));
  const evidence = [...agencyIds].flatMap(agencyId => (['candidate', 'foreign'] as const).flatMap(source => {
    const statement = loadBankStatement(agencyId, source);
    return statement ? [{ agencyId, source, statement, events: loadReconciliationEvents(agencyId).filter(event => (event.source ?? 'foreign') === source) }] : [];
  }));
  const config = getConfig();
  return { ...measure(data, evidence, config.stageFees ?? {}, config.integrityScoreThresholds, now),
    openAgencyCases: getAgencyResolutionCases().filter(record => record.state !== 'resolved').length };
};

const generatedCaseReason = 'DEMO ONLY scenario practice:';
const resolutionKey = 'demo:dawm-agency-resolution';
const scenarioCases = () => getAgencyResolutionCases().filter(record => record.events[0]?.reason.startsWith(generatedCaseReason));
const untouchedGeneratedPause = (record: AgencyResolutionCase) => record.id.startsWith('demo-integrity-paused-')
  && record.events.every(event => event.reason.startsWith(generatedCaseReason)
    && [`${record.id}-opened`, `${record.id}-paused`, `${record.id}-appeal`].includes(event.id));
const requireReplaceableCases = () => {
  if (getAgencyResolutionCases().some(record => record.state !== 'resolved' && record.issue.paymentId.startsWith('demo-')
    && (!record.events.every(event => event.reason.startsWith(generatedCaseReason)) || record.holdActive && !untouchedGeneratedPause(record)))) {
    throw new Error('Resolve existing operator agency cases and explicitly reinstate suspended agencies before replacing generated demo payments.');
  }
};
const refreshScenario = () => {
  window.dispatchEvent(new CustomEvent('bank-statement-changed'));
  window.dispatchEvent(new CustomEvent('agency-resolution-changed'));
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  window.dispatchEvent(new CustomEvent('demo-scenario-changed'));
};

export const applyIntegrityDemoScenario = async (id: IntegrityDemoScenarioId, actor: DemoScenarioActor, confirmed: boolean, reason: string) => {
  requireActor(actor, confirmed, reason);
  requireReplaceableCases();
  const previous = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith(DEMO_KEY_PREFIX)));
  const previousCases = localStorage.getItem(resolutionKey);
  const previousScenario = sessionStorage.getItem('dawm_integrity_scenario');
  const previousVersion = sessionStorage.getItem('dawm_demo_version');
  try {
  bootDemo();
  const now = Date.now();
  const before = measureStoredIntegrityDemo(now);
  const config = getConfig();
  const data = buildIntegrityDemoScenario(id, config.stageFees ?? {}, config.integrityScoreThresholds, now, getCandidates(), getCandidateStages());
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
    // The backup is in memory. Release replaced collections before writing their
    // successors so two complete practice folders never compete for browser quota.
    [LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_DOCUMENTS, LS_MEDICAL_RESULTS, LS_PAYMENTS, LS_PAYMENT_STATUS, LS_APPROVAL_LOGS]
      .forEach(key => localStorage.removeItem(`${DEMO_KEY_PREFIX}${key}`));
    const generatedIds = new Set(scenarioCases().map(record => record.id));
    localStorage.setItem(resolutionKey, JSON.stringify(getAgencyResolutionCases().filter(record => !generatedIds.has(record.id))));
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
    saveCandidateStages([...data.stages, ...retainedStages], { recordHistory: false });
    saveMedicalResults([...data.medicals, ...retainedMedical]);
    saveDocuments([...data.documents, ...retainedDocuments]);
    const generatedCases = data.agencyCases.map(record => ({ ...record, events: record.events.map(event =>
      event.action === 'appeal' ? event : { ...event, actorId: actor.id, actor: actor.email }) }));
    localStorage.setItem(resolutionKey, JSON.stringify([...getAgencyResolutionCases(), ...generatedCases]));
    const generatedLogs = data.logs.map(log => log.actor_id === 'demo-ministry-reviewer' ? { ...log, actor_id: actor.id, actor_email: actor.email } : log);
    saveApprovalLogs([...priorAudits, ...generatedLogs]);
    const audit = { id: `demo-integrity-audit-${crypto.randomUUID()}`, actor_id: actor.id, actor_email: actor.email,
      timestamp: new Date(now).toISOString(), target_type: 'Config', target_id: 'demo-integrity-scenarios', action: 'Updated',
      description: `DEMO ONLY ${id}. Reason: ${reason.trim()}.` } as const;
    saveApprovalLogs([...priorAudits, ...generatedLogs, audit]);
    // Escalate a representative set through the real audited workflow. All other
    // gaps stay visible as payment evidence requests, without creating holds.
    const represented = new Set<string>();
    const foreignDifferences = data.evidence.filter(item => item.source === 'foreign').reduce((count, item) => count + item.events.length, 0);
    const caseLimit = id === 'low' ? 0 : Math.min(2, Math.ceil(foreignDifferences / 15));
    for (const issue of amountDiscrepancies().filter(issue => issue.basis === 'bank' && issue.paymentId.startsWith('demo-integrity-'))) {
      if (represented.size >= caseLimit) break;
      const group = `${issue.agencyId}:${issue.source}:${issue.kind}`;
      if (represented.has(group)) continue;
      represented.add(group);
      await escalateAmountDiscrepancy(issue.id, `${generatedCaseReason} ${id}. Synthetic bank amount needs review, not proven agency fault. ${reason.trim()}`,
        new Date(now + 3 * DAY).toISOString().slice(0, 10), actor);
    }
    const after = measureStoredIntegrityDemo(now);
    saveApprovalLogs([...getApprovalLogs().filter(log => log.id !== audit.id), { ...audit,
      description: `${audit.description} Measured before=${before.score}/${before.level}, after=${after.score}/${after.level}. Synthetic journey=${data.starting.score}→${data.measured.score}. Bank evidence=${JSON.stringify(after.bank)}. No live files or official clearance changed.` }]);
    sessionStorage.setItem('dawm_integrity_scenario', id);
    refreshScenario();
    return { before, after, starting: data.starting };
  } catch (error) {
    Object.entries(localStorage).filter(([key, value]) => key.startsWith(DEMO_KEY_PREFIX) && previous.get(key) !== value).forEach(([key]) => localStorage.removeItem(key));
    previous.forEach((value, key) => { if (localStorage.getItem(key) !== value) localStorage.setItem(key, value); });
    if (previousCases === null) localStorage.removeItem(resolutionKey); else localStorage.setItem(resolutionKey, previousCases);
    if (previousScenario === null) sessionStorage.removeItem('dawm_integrity_scenario'); else sessionStorage.setItem('dawm_integrity_scenario', previousScenario);
    if (previousVersion === null) sessionStorage.removeItem('dawm_demo_version'); else sessionStorage.setItem('dawm_demo_version', previousVersion);
    refreshScenario();
    throw new Error(`Could not switch demo mode; previous demo records were restored. ${error && typeof error === 'object' && 'message' in error ? error.message : 'Browser storage failed.'}`);
  }
};

export const resetIntegrityDemoScenario = (actor: DemoScenarioActor, confirmed: boolean, reason: string) => {
  requireActor(actor, confirmed, reason);
  requireReplaceableCases();
  const paymentAgencyIds = new Set(getPayments().map(payment => payment.payee_local_agency_id));
  if ([...paymentAgencyIds].some(agencyId => (['candidate', 'foreign'] as const).some(source => {
    const statement = loadBankStatement(agencyId, source);
    return statement && !statement.synthetic;
  }))) throw new Error('An uploaded statement is present. Remove it explicitly before resetting demo evidence.');
  const before = measureStoredIntegrityDemo();
  const config = getConfig();
  const priorAudits = getApprovalLogs().filter(log => log.target_id === 'demo-integrity-scenarios');
  bootDemo();
  bootDemo();
  saveConfig(config);
  Object.keys(localStorage).filter(key => key.startsWith(`${DEMO_KEY_PREFIX}dawm_bank_statement:demo-`)
    || key.startsWith(`${DEMO_KEY_PREFIX}bank_evidence_initialized:demo-`)).forEach(key => localStorage.removeItem(key));
  loadDemoData();
  const generatedIds = new Set(scenarioCases().map(record => record.id));
  localStorage.setItem(resolutionKey, JSON.stringify(getAgencyResolutionCases().filter(record => !generatedIds.has(record.id))));
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
  refreshScenario();
  return { before, after };
};
