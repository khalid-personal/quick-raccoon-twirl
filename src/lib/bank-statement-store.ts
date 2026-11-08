import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import { reconcile, summarizeReconciliation } from './bank-reconciliation';
import type { BankLine, ReconciliationSummary } from './bank-reconciliation';
import type { Payment } from './types';
import { validEvidenceDate } from './evidence-requests';

export interface ReconciliationCaseEvent {
  id: string;
  caseId: string;
  action: 'review' | 'request-evidence' | 'escalate' | 'resolve';
  note: string;
  actor: string;
  owner: string;
  dueDate: string;
  submissionStart?: string;
  source?: PaymentStatementSource;
  synthetic?: boolean;
  override?: { decision: 'accept' | 'revoke'; actorId: string; priorStatus: string; auditId: string };
  createdAt: string;
  evidence: { payment?: Payment; line?: BankLine; statementName: string; explanation: string };
}

const caseKey = (agencyId: string) => `${keyFor(agencyId)}:cases`;

export const loadReconciliationEvents = (agencyId: string): ReconciliationCaseEvent[] => {
  try { return JSON.parse(localStorage.getItem(caseKey(agencyId)) || '[]'); } catch { return []; }
};

export const recordReconciliationEvent = (agencyId: string, input: Omit<ReconciliationCaseEvent, 'id' | 'createdAt'>): ReconciliationCaseEvent => {
  if (!agencyId || !input.note.trim() || !input.actor.trim()) throw new Error('Agency, actor and review note are required.');
  if (input.action === 'escalate' || input.action === 'request-evidence') {
    if (!input.owner.trim() || !validEvidenceDate(input.dueDate)) throw new Error('An owner and valid due date are required.');
  }
  if (input.dueDate && !validEvidenceDate(input.dueDate)) throw new Error('Choose a valid evidence deadline.');
  if (input.submissionStart && (!validEvidenceDate(input.submissionStart) || !input.dueDate || input.submissionStart > input.dueDate)) throw new Error('The submission window must start on or before its deadline.');
  const event = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  localStorage.setItem(caseKey(agencyId), JSON.stringify([...loadReconciliationEvents(agencyId), event]));
  window.dispatchEvent(new CustomEvent('bank-statement-changed'));
  return event;
};

export interface BankStatement {
  name: string;
  lines: BankLine[];
  synthetic?: boolean;
  covered_candidate_ids?: string[];
  demo_original?: { synthetic: true; bank_name: string; account_name: string; period_start: string; period_end: string; balances: Array<{ currency: string; opening_balance: number; total_credits: number; total_debits: number; closing_balance: number }>; complete: true };
  scan_report?: { status: 'clear' | 'review' | 'blocked'; findings: string[]; scanned_at: string; fingerprint?: string };
}

export type PaymentStatementSource = 'foreign' | 'candidate';
const keyFor = (agencyId: string, source: PaymentStatementSource = 'foreign') => `${isDemoMode() ? DEMO_KEY_PREFIX : ''}dawm_bank_statement:${agencyId}${source === 'candidate' ? ':candidate' : ''}`;

export const loadBankStatement = (agencyId: string, source: PaymentStatementSource = 'foreign'): BankStatement | null => {
  try { return JSON.parse(localStorage.getItem(keyFor(agencyId, source)) || 'null') as BankStatement | null; } catch { return null; }
};

export const saveBankStatement = (agencyId: string, statement: BankStatement, source: PaymentStatementSource = 'foreign'): void => {
  localStorage.setItem(keyFor(agencyId, source), JSON.stringify(statement));
  window.dispatchEvent(new CustomEvent('bank-statement-changed'));
};

export const removeBankStatement = (agencyId: string, source: PaymentStatementSource = 'foreign'): void => {
  localStorage.removeItem(keyFor(agencyId, source));
  window.dispatchEvent(new CustomEvent('bank-statement-changed'));
};

export const getBankReconciliationSummary = (agencyId: string, payments: Payment[]): ReconciliationSummary | null => {
  const statement = loadBankStatement(agencyId);
  return statement ? summarizeReconciliation(reconcile(payments, statement.lines)) : null;
};
