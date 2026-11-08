import { useEffect, useId, useState } from 'react';
import { ArrowUpRight, CheckCircle2, FileSearch, MessageSquare, Save, ShieldAlert, FilePlus2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { BankLine, PaymentMatch } from '@/lib/bank-reconciliation';
import type { Payment } from '@/lib/types';
import { loadBankStatement, loadReconciliationEvents, recordReconciliationEvent, type ReconciliationCaseEvent } from '@/lib/bank-statement-store';
import { getConfig, getPayments, getStaffUsers } from '@/lib/data-store';
import { activeEvidenceOverride, evidenceReviewStatus, matchPaymentEvidence } from '@/lib/payment-evidence-status';
import { createMatchedDemoEvidence, overridePaymentEvidence, simulateMatchingDeposit } from '@/lib/api/evidence-review';
import { isDemoMode } from '@/lib/demo-mode';
import PaymentEvidenceDocuments from './PaymentEvidenceDocuments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PaymentProvenance from './PaymentProvenance';
import { EVIDENCE_STATUS_LABELS, getEvidenceRequests } from '@/lib/evidence-requests';
import { isForeignPayment } from '@/lib/currency';
import type { PaymentStatementSource } from '@/lib/bank-statement-store';
import PaymentEvidenceOverview from './PaymentEvidenceOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InvestigationGuide from './InvestigationGuide';
import { amountDiscrepancies } from '@/lib/agency-resolution';
import { submissionDeadline } from '@/lib/submission-policy';
import { currentVerifiedPaymentIds } from '@/lib/payment-review-clearance';
import { isForeignAgencyRole } from '@/lib/api/auth';

export interface PaymentEvidence {
  caseId: string;
  payment?: Payment;
  issue?: string;
  explanation?: string;
  expected?: { amount?: number; currency?: string; payer: string; payee: string };
  match?: PaymentMatch;
  line?: BankLine;
  source?: PaymentStatementSource;
  candidateId?: string;
  stageTitle?: string;
}

type ReviewProps = {
  agencyId: string; evidence: PaymentEvidence | null; statementName: string; onClose: () => void; allowActions?: boolean; activation?: number;
};

export default function PaymentEvidenceReview(props: ReviewProps) {
  const { userRole } = useAuth();
  if (isForeignAgencyRole(userRole) || userRole === 'candidate' || !userRole) return null;
  return <AuditedPaymentReview {...props} />;
}

function AuditedPaymentReview({ agencyId, evidence, statementName, onClose, allowActions = true, activation }: ReviewProps) {
  const { user, userRole } = useAuth();
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;
  const [events, setEvents] = useState<ReconciliationCaseEvent[]>([]);
  const [action, setAction] = useState<ReconciliationCaseEvent['action']>('review');
  const [note, setNote] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submissionStart, setSubmissionStart] = useState('');
  const [deadlineError, setDeadlineError] = useState('');
  const [tab, setTab] = useState('summary');
  const [, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => { setVersion(value => value + 1); setEvents(loadReconciliationEvents(agencyId)); };
    window.addEventListener('bank-statement-changed', refresh);
    window.addEventListener('supabase-data-changed', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [agencyId]);
  useEffect(() => {
    const next = loadReconciliationEvents(agencyId);
    setEvents(next);
    const request = getEvidenceRequests(next).find(item => item.event.caseId === evidence?.caseId)?.event;
    setNote(''); setOwner(request?.owner ?? getStaffUsers().find(staff => staff.role === 'local-agency' && staff.local_agency_id === agencyId)?.email ?? '');
    try {
      const deadline = request ? { start: request.submissionStart ?? '', end: request.dueDate } : submissionDeadline(getConfig());
      setDueDate(deadline.end); setSubmissionStart(deadline.start); setDeadlineError('');
    } catch (error) {
      setDueDate(''); setSubmissionStart(''); setDeadlineError(error instanceof Error ? error.message : 'Could not read submission dates.');
    }
    setAction('review');
    setTab('summary');
  }, [agencyId, evidence?.caseId]);

  const recordedPayment = evidence?.payment ?? evidence?.match?.payment;
  const payment = recordedPayment ? getPayments().find(saved => saved.id === recordedPayment.id) : undefined;
  const source = evidence?.source ?? (recordedPayment && !isForeignPayment(recordedPayment) ? 'candidate' : 'foreign');
  const statement = loadBankStatement(agencyId, source);
  const match = payment ? matchPaymentEvidence(payment, getPayments(), statement) : undefined;
  const line = payment ? match?.line : statement ? evidence?.line : undefined;
  const fullyVerified = !!payment && currentVerifiedPaymentIds().has(payment.id);
  const bankStatus = evidenceReviewStatus(payment, match);
  const status = bankStatus === 'failed' ? 'failed' : fullyVerified ? 'settled' : 'pending';
  const override = activeEvidenceOverride(events, evidence?.caseId ?? '', payment, match);
  const currentEvidence = evidence ? { ...evidence, payment, match, line } : null;
  const currentStatementName = statement?.name ?? statementName;
  const explanation = evidence?.explanation ?? match?.explanation ?? (payment ? 'Ledger metadata only. No bank comparison was performed for this transaction; missing statement evidence is not proof of a missing deposit.' : 'The bank statement contains a credit without a linked payment record. Identify its payer and obtain a receipt before assigning it. This may be an unrelated credit; the cause is not confirmed.');
  const history = events.filter(event => event.caseId === evidence?.caseId);
  const latest = history.at(-1);
  const request = getEvidenceRequests(history)[0];
  const escalated = action === 'escalate' || action === 'request-evidence';
  const administer = async (decision: 'accept' | 'revoke' | 'simulate' | 'complete-demo') => {
    if (!evidence) return;
    setBusy(true);
    try {
      const actor = { id: user?.id ?? '', email: user?.email ?? '', role: userRole ?? '' };
      if (decision === 'complete-demo' && payment) await createMatchedDemoEvidence(payment.id, source, actor);
      else if (decision === 'simulate' && payment) await simulateMatchingDeposit(payment.id, source, actor);
      else if (decision === 'accept' || decision === 'revoke') await overridePaymentEvidence(agencyId, {
        caseId: evidence.caseId, source, decision, note, match,
        evidence: { payment, line, statementName: currentStatementName, explanation },
      }, actor);
      setEvents(loadReconciliationEvents(agencyId)); setVersion(value => value + 1); setNote('');
      toast.success(decision === 'complete-demo' ? 'Complete matching synthetic demo evidence generated and audit logged.' : decision === 'simulate' ? 'Synthetic demo bank row added and audit logged.' : 'Override audit logged. Payment and bank facts are unchanged.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Evidence action failed.'); }
    finally { setBusy(false); }
  };
  const save = () => {
    if (!evidence) return;
    try {
      if (action === 'resolve' && payment && amountDiscrepancies().some(issue => issue.paymentId === payment.id)) throw new Error('There is still a difference in the payment amounts. Create a documented follow-up in Payment issues instead of closing it without an explanation.');
      recordReconciliationEvent(agencyId, {
        caseId: evidence.caseId, action, note, owner, dueDate, actor: user?.email || user?.id || '',
        submissionStart: submissionStart || undefined,
        source: evidence.source ?? (payment && !isForeignPayment(payment) ? 'candidate' : 'foreign'),
        synthetic: !!statement?.synthetic || history.some(event => event.synthetic) || statementName.startsWith('DEMO /'),
        evidence: { payment, line, statementName, explanation },
      });
      setEvents(loadReconciliationEvents(agencyId)); setNote('');
      toast.success('Review action recorded locally. No external notification was sent.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save review.'); }
  };
  const actions = [
    { value: 'review', label: 'Add a note', hint: 'Explain what you found', icon: MessageSquare },
    { value: 'request-evidence', label: 'Record a proof request', hint: 'Choose who should follow up and by when', icon: FilePlus2 },
    { value: 'escalate', label: 'Flag for specialist review', hint: 'Record that finance or compliance should check it', icon: ShieldAlert },
    { value: 'resolve', label: 'Close the case', hint: 'Record how it was resolved', icon: CheckCircle2 },
  ] as const;
  return <Dialog activationKey={activation} open={!!evidence} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2"><FileSearch className="h-5 w-5" />Check payment and bank records{payment && <span className="text-sm font-normal text-muted-foreground"> · {payment.receipt_number || payment.provider_reference || payment.id}</span>}</DialogTitle>
        <DialogDescription>Compare the payment receipt with credit entries in the agency’s uploaded bank file. A match helps link the records, but does not confirm the file with the bank. {statement?.synthetic || statementName.startsWith('DEMO /') ? 'DEMO / synthetic records, not real bank proof.' : 'Uploaded records have not been confirmed by the bank.'}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={status === 'settled' ? 'bg-emerald-600 text-white' : status === 'failed' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}>{status === 'settled' ? 'Payment marked received · details match' : status === 'failed' ? 'Payment failed or refunded' : 'Payment not yet confirmed · review needed'}</Badge>
        {override && <Badge variant="outline">Superadmin accepted exception · audit logged</Badge>}
        {allowActions && <Badge variant="secondary" className={fullyVerified ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : undefined}>Review: {fullyVerified ? 'Automatically cleared after all checks' : latest?.action === 'resolve' ? 'Closed by reviewer' : request ? 'Waiting for proof' : latest ? 'Being reviewed' : 'Not reviewed'}</Badge>}
        {request && !fullyVerified && <Badge variant={request.status === 'overdue' ? 'destructive' : 'outline'}>{EVIDENCE_STATUS_LABELS[request.status]} · {request.event.submissionStart || request.event.createdAt.slice(0, 10)} through {request.event.dueDate}</Badge>}
      </div>
      {userRole === 'superadmin' && isDemoMode() && payment?.id.startsWith('demo-') && ['pending', 'succeeded'].includes(payment.status) && (!statement || statement.synthetic) && <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
        <p>Demo investigators can create a fictional bank confirmation, a complete sample statement and a linked identity snapshot. A pending demo payment becomes a simulated payment marked received; contract or stage-fee issues and agency suspensions stay in place.</p>
        <Button className="mt-2" disabled={busy} variant="outline" onClick={() => administer('complete-demo')}>Create matched demo evidence · audit logged</Button>
      </section>}
      {recordedPayment && !payment && <p role="alert" className="text-sm text-destructive">This receipt is no longer in the current payment records. Historical snapshots are not current proof.</p>}
      {deadlineError && <p role="alert" className="text-sm text-destructive">{deadlineError}</p>}
      {allowActions && <InvestigationGuide payment={payment} match={match} issue={fullyVerified ? undefined : evidence?.issue} onLeave={onClose} onAction={value => { setAction(value); setTab('action'); }} />}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Payment review sections"><TabsTrigger value="summary"><FileSearch aria-hidden="true" />Money comparison</TabsTrigger>{allowActions && <TabsTrigger value="action"><MessageSquare aria-hidden="true" />Next action · {history.length} updates</TabsTrigger>}{userRole === 'superadmin' && payment && <TabsTrigger value="investigate"><ShieldAlert aria-hidden="true" />Who did what</TabsTrigger>}</TabsList>
        <TabsContent value="summary" className="space-y-4 pt-3"><PaymentEvidenceDocuments payment={payment} statement={statement} match={match} />{match?.status === 'matched' && !fullyVerified && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">The receipt matches an entry in the uploaded file for amount, currency and reference. This only links the two records; it does not confirm the entry with the bank. Full clearance also depends on assigning the payment to the right candidate or contract and, for stage fees, confirming the fee, completed stage and earlier stages. Do not fill in missing details by guessing.</p>}{currentEvidence && <PaymentEvidenceOverview evidence={currentEvidence} statementName={currentStatementName} />}{userRole === 'superadmin' && isDemoMode() && statement?.synthetic && payment?.status === 'succeeded' && bankStatus !== 'settled' && <Button disabled={busy} variant="outline" onClick={() => administer('simulate')}>Add a matching demo bank entry · audit logged</Button>}{allowActions && <Button onClick={() => setTab('action')}><ArrowUpRight className="mr-2 h-4 w-4" />Choose the next action</Button>}</TabsContent>
        {userRole === 'superadmin' && payment && <TabsContent value="investigate"><PaymentProvenance payment={payment} onCandidateOpen={onClose} /></TabsContent>}
      {allowActions && <TabsContent value="action"><section className="space-y-4 pt-3">
        <h3 className="flex items-center gap-2 font-semibold"><ArrowUpRight className="h-4 w-4" />What should happen next?</h3>
        <p className="text-xs text-muted-foreground">Proof-request dates come from the ministry calendar (or default to seven days from today until one is set). Existing requests keep their original deadlines. The portal records requests but does not send them by email or text; contact the assigned person directly.</p>
        {dueDate && dueDate < new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Addis_Ababa' }).format(new Date()) && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">This retained deadline is overdue. Changing the ministry calendar does not rewrite issued requests. Explicitly reissue and record any extension.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{actions.map(({ value, label, hint, icon: Icon }) => <button type="button" key={value} aria-pressed={action === value} className={`rounded-xl border p-3 text-left transition-colors hover:bg-accent ${action === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`} onClick={() => setAction(value)}><Icon className="mb-2 h-5 w-5 text-primary" /><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></button>)}</div>
        {escalated && <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
          <div><Label htmlFor={fieldId('case-owner')}>Person responsible {escalated ? '(required)' : '(optional)'}</Label><Input id={fieldId('case-owner')} data-field="case-owner" value={owner} onChange={event => setOwner(event.target.value)} placeholder="Name or email" /></div>
          <div><Label htmlFor={fieldId('case-start')}>First day to send proof (optional)</Label><Input id={fieldId('case-start')} data-field="case-start" type="date" max={dueDate || undefined} value={submissionStart} onChange={event => setSubmissionStart(event.target.value)} /></div>
          <div><Label htmlFor={fieldId('case-due')}>Last day to send proof {escalated ? '(required)' : '(optional)'}</Label><Input id={fieldId('case-due')} data-field="case-due" type="date" min={submissionStart || undefined} value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>
        </div>}
        <div><Label htmlFor={fieldId('case-note')}>What did you check or ask for? (required)</Label><Textarea id={fieldId('case-note')} data-field="case-note" value={note} onChange={event => setNote(event.target.value)} placeholder="Example: The uploaded file shows 400 ETB less. Ask the agency for a deposit slip." /></div>
        <Button onClick={save} disabled={!note.trim() || (escalated && (!owner.trim() || !dueDate))}><Save className="mr-2 h-4 w-4" />Record action</Button>
        {userRole === 'superadmin' && <section className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"><h4 className="font-semibold">Administrator exception</h4><p className="text-xs text-muted-foreground">Give a reason. The portal records who accepted it, when, the previous status and the evidence available at the time. An exception does not create a bank deposit, mark money received or bypass stage fees. If the evidence changes, the exception no longer applies.</p><div className="flex flex-wrap gap-2"><Button disabled={busy || !note.trim() || !!override} variant="outline" onClick={() => administer('accept')}>Accept this exception · recorded</Button><Button disabled={busy || !note.trim() || !override} variant="outline" onClick={() => administer('revoke')}>Withdraw exception · recorded</Button></div></section>}
        <h4 className="flex items-center gap-2 border-t pt-4 text-sm font-semibold"><CalendarDays className="h-4 w-4" />What has happened so far</h4>
        <ol className="space-y-3 border-l pl-4">
          {[...history].reverse().map(event => <li key={event.id} className="text-sm"><p className="font-medium">{event.action.replace('-', ' ')} · {event.actor}</p><p className="whitespace-pre-wrap break-words">{event.note}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}{event.owner && ` · Responsible person: ${event.owner}`}{event.dueDate && ` · Due: ${event.dueDate}`}</p><details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Records available at the time</summary><p className="mt-1 break-words">{event.evidence.statementName} · Receipt {event.evidence.payment?.receipt_number || 'not recorded'} · Payment record {event.evidence.payment?.amount ?? 'none'} {event.evidence.payment?.currency} · Uploaded bank entry {event.evidence.line?.amount ?? 'missing'} {event.evidence.line?.currency}</p><p>{event.evidence.explanation}</p></details></li>)}
          {!history.length && <li className="text-sm text-muted-foreground">No review actions recorded.</li>}
        </ol>
      </section></TabsContent>}
      </Tabs>
    </DialogContent>
  </Dialog>;
}