import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, CheckCircle2, Clock3, FileSearch, MessageSquare, Scale, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { amountDiscrepancies, autoResolveVerifiedAgencyCases, getAgencyResolutionCases, agencyCaseName, escalateAmountDiscrepancy, decideAgencyCase, appealAgencyCase, type AgencyResolutionCase, type AmountDiscrepancy } from '@/lib/agency-resolution';
import PaymentEvidenceReview from './PaymentEvidenceReview';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { getConfig, getPayments } from '@/lib/data-store';
import { submissionDeadline } from '@/lib/submission-policy';

const issueSummary = (issue: AmountDiscrepancy) => `${issue.kind === 'underpayment' ? 'Less money than expected' : 'More money than expected'} compared with the ${issue.basis === 'bank' ? 'uploaded bank file' : issue.basis === 'contract' ? 'work contract' : 'candidate stage fee'}`;

export default function AgencyResolutionCenter({ agencyNotice = false, agencyScope }: { agencyNotice?: boolean; agencyScope?: { type: 'local' | 'foreign'; id: string } }) {
  const auth = useAuth();
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;
  const admin = auth.userRole === 'superadmin';
  const actor = { id: auth.viewAs?.userId ?? auth.user?.id ?? '', email: auth.user?.email ?? '', role: auth.userRole ?? '', localAgencyId: auth.userLocalAgencyId, foreignAgencyId: auth.userForeignAgencyId };
  const enabled = admin || auth.userRole === 'local-agency' || auth.userRole === 'staff' && !!auth.userLocalAgencyId || ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(auth.userRole ?? '');
  const data = useQuery({ queryKey: ['agency-resolution', auth.isDemo, auth.user?.id, auth.viewAs?.userId, auth.userRole, auth.userLocalAgencyId, auth.userForeignAgencyId], enabled,
    queryFn: async () => {
      if (admin && actor.id && actor.email) await autoResolveVerifiedAgencyCases(actor);
      return { cases: getAgencyResolutionCases(), issues: admin && !agencyNotice ? amountDiscrepancies() : [] };
    }, refetchInterval: 30000 });
  const refetch = data.refetch;
  useEffect(() => {
    const refresh = () => { if (enabled) void refetch(); };
    window.addEventListener('agency-resolution-changed', refresh); window.addEventListener('bank-statement-changed', refresh); window.addEventListener('supabase-data-changed', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('agency-resolution-changed', refresh); window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [refetch, enabled]);
  const [selected, setSelected] = useState<AgencyResolutionCase | AmountDiscrepancy | null>(null);
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'appeals' | 'suspended' | 'closed'>('all');
  const [showAll, setShowAll] = useState(false);
  const [reviewPayment, setReviewPayment] = useState<AmountDiscrepancy | null>(null);
  const cases = (data.data?.cases ?? []).filter(record => (admin || record.issue.agencyType === 'local' && record.issue.agencyId === auth.userLocalAgencyId && ['local-agency', 'staff'].includes(auth.userRole ?? '')
    || record.issue.agencyType === 'foreign' && record.issue.agencyId === auth.userForeignAgencyId && ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(auth.userRole ?? ''))
    && (!agencyScope || record.issue.agencyType === agencyScope.type && record.issue.agencyId === agencyScope.id));
  const open = cases.filter(record => record.state !== 'resolved');
  const fresh = (data.data?.issues ?? []).filter(issue => (!agencyScope || issue.agencyType === agencyScope.type && issue.agencyId === agencyScope.id) && !cases.some(record => record.issue.id === issue.id && (record.state !== 'resolved' || record.issue.snapshot === issue.snapshot)));
  const selectedCase = selected && 'issue' in selected ? cases.find(record => record.id === selected.id) : undefined;
  const issue = selectedCase?.issue ?? (selected && !('issue' in selected) ? selected : null);
  const select = (item: AgencyResolutionCase | AmountDiscrepancy) => {
    setSelected(item); setReason(''); setEvidenceUrl(''); setDueDate('');
    try { setDueDate('issue' in item ? item.dueDate : submissionDeadline(getConfig()).end); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not read submission dates.'); }
  };
  const execute = async (action: 'escalate' | 'suspend' | 'request-follow-up' | 'reject-appeal' | 'reinstate' | 'resolve' | 'appeal') => {
    if (!issue) return;
    setBusy(true);
    try {
      if (action === 'escalate') { const record = await escalateAmountDiscrepancy(issue.id, reason, dueDate, actor); setSelected(record); }
      else if (selectedCase && action === 'appeal') await appealAgencyCase(selectedCase.id, reason, evidenceUrl, actor);
      else if (selectedCase && action !== 'appeal') await decideAgencyCase(selectedCase.id, action, reason, actor);
      else throw new Error('Select an open case.');
      await data.refetch(); setReason(''); setEvidenceUrl('');
      toast.success('Decision saved in the portal. No message was sent outside the portal.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not record this decision.'); }
    finally { setBusy(false); }
  };
  if (!enabled || agencyNotice && admin || agencyNotice && !open.length && !data.error) return null;
  const waiting = open.filter(record => record.state !== 'appealed' && !record.holdActive);
  const suspended = open.filter(record => record.state !== 'appealed' && record.holdActive);
  const appeals = open.filter(record => record.state === 'appealed');
  const columns = [
    { id: 'new', title: 'New differences', subtitle: 'Check the records first', icon: FileSearch, color: 'border-amber-500/25 bg-amber-500/5', items: fresh },
    { id: 'waiting', title: 'Waiting for a reply', subtitle: 'Follow up with the agency', icon: Clock3, color: 'border-sky-500/25 bg-sky-500/5', items: waiting },
    { id: 'suspended', title: 'Agency paused', subtitle: 'A separate decision is required', icon: ShieldAlert, color: 'border-rose-500/25 bg-rose-500/5', items: suspended },
    { id: 'appeals', title: 'Appeals to review', subtitle: 'Read the agency’s explanation', icon: MessageSquare, color: 'border-violet-500/25 bg-violet-500/5', items: filter === 'suspended' ? appeals.filter(record => record.holdActive) : appeals },
    { id: 'closed', title: 'Closed cases', subtitle: 'Decisions kept for reference', icon: CheckCircle2, color: 'border-emerald-500/25 bg-emerald-500/5', items: cases.filter(record => record.state === 'resolved') },
  ].filter(column => filter === 'all' && column.id !== 'closed' || filter === 'appeals' && column.id === 'appeals' || filter === 'suspended' && (column.id === 'suspended' || column.id === 'appeals') || filter === 'closed' && column.id === 'closed')
    .filter(column => admin && !agencyNotice || column.id !== 'new');
  const payments = getPayments();
  const caseCard = (item: AgencyResolutionCase | AmountDiscrepancy) => {
    const record = 'issue' in item ? item : undefined;
    const currentIssue = 'issue' in item ? item.issue : item;
    const payment = payments.find(payment => payment.id === currentIssue.paymentId);
    return <article key={record?.id ?? currentIssue.id} className="group space-y-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background"><Building2 className="h-5 w-5 text-muted-foreground" /></span><Badge variant={currentIssue.kind === 'underpayment' ? 'outline' : 'secondary'} className="text-xs">{currentIssue.kind === 'underpayment' ? 'Below expected' : 'Above expected'}</Badge></div>
      <div><p className="text-base font-semibold leading-snug">{agencyCaseName(currentIssue)}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{issueSummary(currentIssue)}</p></div>
      {payment && <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Recorded payment</p><p className="mt-1 text-lg font-semibold tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</p><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{payment.receipt_number || payment.provider_reference || payment.id}</p></div>}
      {record && <div className="flex flex-wrap gap-2"><Badge variant={record.holdActive ? 'destructive' : 'secondary'}>{record.state === 'resolved' ? 'Issue closed' : record.holdActive ? 'New agency activity paused' : 'Waiting for a decision'}</Badge>{record.state === 'appealed' && <Badge variant="outline">Appeal waiting for review</Badge>}<p className="w-full text-xs text-muted-foreground">{record.state === 'resolved' ? `Updated ${record.updatedAt.slice(0, 10)}` : `Reply by ${record.dueDate}`}</p>{record.state !== 'resolved' && record.dueDate < new Date().toISOString().slice(0, 10) && <Badge variant="destructive">Reply overdue</Badge>}</div>}
      <Button className="w-full justify-between rounded-xl" size="sm" variant="outline" onClick={() => select(item)}>{record ? admin ? 'Review this issue' : 'Explain or appeal' : 'Review difference'}<ArrowUpRight className="h-4 w-4" /></Button>
    </article>;
  };
  return <section aria-label={admin ? 'Payment issue workspace' : 'Agency payment notices'} className="overflow-hidden rounded-3xl border border-slate-500/20 bg-card shadow-sm">
    <header className="relative overflow-hidden border-b bg-gradient-to-br from-[#17243b] via-[#152035] to-[#26314b] p-5 text-white sm:p-7">
      <div aria-hidden="true" className="absolute -right-16 -top-28 h-72 w-72 rounded-full border-[35px] border-white/[0.03]" />
      <div className="relative flex flex-wrap items-center justify-between gap-5"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5"><Scale className="h-6 w-6 text-sky-200" strokeWidth={1.5} /></span><div className="max-w-xl"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/70">Review · follow up · decide</p><h3 className="mt-1 text-2xl font-bold">{admin ? 'Payment issues' : 'Payment notice and appeal'}</h3><p className="mt-2 text-sm leading-relaxed text-white/65">{admin ? 'Move each issue through review, agency reply and a recorded decision. Open a card to check the details and choose the next action.' : 'Read the notice and send an explanation or appeal. A suspension stays active until an administrator explicitly removes it.'}</p></div></div><div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3"><p className="text-3xl font-bold tabular-nums">{open.length + fresh.length}</p><p className="mt-1 text-xs text-white/60">Items needing attention</p></div></div>
    </header>
    <div className="space-y-5 p-5 sm:p-6">
    {data.error && <div role="alert" className="rounded-xl border border-destructive p-3"><p>{data.error.message}</p><Button variant="outline" onClick={() => void data.refetch()}>Reload payment issues</Button></div>}
    {data.isLoading && <p role="status">Loading payment issues…</p>}
    <details className="rounded-2xl border bg-background/60 p-4 text-sm"><summary className="cursor-pointer font-semibold">How reviews and agency suspensions work</summary><p className="mt-3 leading-relaxed text-muted-foreground">Suspending an agency pauses new candidate registrations, assigning candidates to that agency, sharing its profile and new payments from foreign agencies in this portal. Existing support, past records, appeals and candidate payments remain available. This is a portal restriction, not a legal finding or a freeze by the payment provider. A candidate’s unpaid stage fee alone cannot suspend an agency; an administrator must choose suspension and record a reason.</p><p className="mt-3 text-muted-foreground">Payments that pass every required check are cleared automatically. Fixing payment records does not lift a suspension; an administrator must make that decision separately.</p></details>
    <div className="flex flex-wrap gap-2">{(['all', 'appeals', 'suspended', 'closed'] as const).map(value => <Button size="sm" key={value} aria-pressed={filter === value} variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{value === 'all' ? 'All open cases' : value === 'appeals' ? 'Appeals' : value === 'closed' ? 'Closed cases' : 'Suspended agencies'}</Button>)}</div>
    {admin && !agencyNotice && filter === 'all' && <p className="text-xs leading-relaxed text-muted-foreground">New differences are warnings, not opened cases or proof of wrongdoing. Review the records and start a documented follow-up to open a case. Changing stages requires a recorded decision, never a drag-and-drop shortcut.</p>}
    <div aria-label="Payment issue stages" className={`grid items-start gap-4 ${columns.length > 2 ? 'md:grid-cols-2 2xl:grid-cols-4' : 'md:grid-cols-2'}`}>{columns.map(({ id, title, subtitle, icon: Icon, color, items }) => <section key={id} aria-label={title} className={`min-w-0 rounded-2xl border ${color}`}>
      <header className="flex items-start justify-between gap-2 border-b border-inherit p-4"><div><h4 className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" />{title}</h4><p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p></div><span className="rounded-lg border border-inherit bg-background/70 px-2 py-1 text-xs font-semibold tabular-nums">{items.length}</span></header>
      <div className="space-y-3 p-3">{(showAll ? items : items.slice(0, 6)).map(caseCard)}{!items.length && <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center"><Icon className="h-6 w-6 text-muted-foreground/40" /><p className="text-xs text-muted-foreground">No items at this stage</p></div>}</div>
    </section>)}</div>
    {!open.length && !fresh.length && !data.error && !data.isLoading && <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5"><CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" /><div><p className="font-semibold">No payment issues need review.</p><p className="mt-1 text-sm text-muted-foreground">There are no open cases{admin ? ' or detected amount differences' : ''} in these records.{auth.isDemo && ' Demo High is meant to be clear. Choose a lower demo example in Settings to practice reviewing problems.'}</p></div></div>}
    {!showAll && columns.some(column => column.items.length > 6) && <Button variant="ghost" onClick={() => setShowAll(true)}>Show all payment issues</Button>}
    <Dialog open={!!selected && !reviewPayment} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{issue && agencyCaseName(issue)} · payment issue</DialogTitle><DialogDescription>Check the payment records and ask for an explanation before deciding. Only an administrator can suspend an agency. An appeal does not lift the suspension; it stays active until an administrator explicitly removes it.</DialogDescription></DialogHeader>
      {issue && <><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="font-semibold capitalize">{issue.kind} · {issue.basis} check</p><p className="mt-2 text-sm">{issue.explanation}</p></div>
        <ol aria-label="Case review steps" className="grid gap-3 sm:grid-cols-3">{['1. Compare the receipt, bank file and contract', '2. Ask for an explanation or more proof', '3. Decide, record why and follow up'].map((step, index) => {
          const activeStep = !selectedCase ? 0 : selectedCase.state === 'escalated' ? 1 : 2;
          return <li aria-current={index === activeStep ? 'step' : undefined} className={`rounded-xl border p-4 text-sm font-semibold ${index === activeStep ? 'border-primary/40 bg-primary/10 shadow-sm' : 'bg-muted/30 text-muted-foreground'}`} key={step}><span aria-hidden="true" className={`mb-3 flex h-7 w-7 items-center justify-center rounded-lg text-xs ${index === activeStep ? 'bg-primary text-primary-foreground' : 'border bg-background'}`}>{`0${index + 1}`}</span>{step}</li>;
        })}</ol>
        {admin && <Button variant="outline" onClick={() => setReviewPayment(issue)}>View receipt and bank records</Button>}
        {!selectedCase && <div><Label htmlFor={fieldId('resolution-due')}>Reply deadline</Label><Input type="date" id={fieldId('resolution-due')} data-field="resolution-due" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>}
        <div><Label htmlFor={fieldId('resolution-reason')}>{admin ? 'Reason for this decision or follow-up (at least 10 characters)' : 'Your explanation or appeal (at least 10 characters)'}</Label><Textarea id={fieldId('resolution-reason')} data-field="resolution-reason" value={reason} onChange={event => setReason(event.target.value)} /></div>
        {!admin && <div><Label htmlFor={fieldId('resolution-url')}>Link to supporting proof (optional)</Label><Input id={fieldId('resolution-url')} data-field="resolution-url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://" /></div>}
        <div className="flex flex-wrap gap-2">{!selectedCase && admin ? <Button disabled={busy || reason.trim().length < 10 || !dueDate} onClick={() => void execute('escalate')}>Start documented follow-up</Button> : admin && selectedCase ? <><Button variant="outline" disabled={busy || reason.trim().length < 10 || selectedCase.state === 'resolved'} onClick={() => void execute('request-follow-up')}>Ask agency for more information</Button>        <Button variant="destructive" disabled={busy || reason.trim().length < 10 || selectedCase.holdActive || selectedCase.state === 'resolved' || selectedCase.issue.basis === 'stage-fee'} onClick={() => void execute('suspend')}>Pause new activity for this agency</Button>{selectedCase.state === 'appealed' && <Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => void execute('reject-appeal')}>Decline appeal and keep suspension</Button>}{selectedCase.holdActive ? <Button disabled={busy || reason.trim().length < 10} onClick={() => void execute('reinstate')}>Accept explanation and lift suspension</Button> : <Button disabled={busy || reason.trim().length < 10 || selectedCase.state === 'resolved'} onClick={() => void execute('resolve')}>Close issue with an explanation</Button>}</> : <Button disabled={busy || reason.trim().length < 10 || selectedCase?.state === 'resolved'} onClick={() => void execute('appeal')}>Send explanation or appeal</Button>}</div>
        {selectedCase?.issue.basis === 'stage-fee' && <p className="text-sm text-muted-foreground">A candidate’s unpaid stage fee alone cannot be used to suspend an agency.</p>}
        {selectedCase && <><h4 className="font-semibold">Appeal and decision history</h4><ol className="space-y-3 border-l pl-4">{[...selectedCase.events].reverse().map(event => <li key={event.id}><p className="text-sm font-semibold">{event.action} · {event.actor}</p><p className="text-sm">{event.reason}</p>{event.evidenceUrl && <a href={event.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Supporting proof</a>}<p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString()} · Decision record {event.auditId}</p></li>)}</ol></>}
      </>}
    </DialogContent></Dialog>
    <ResolutionEvidence issue={reviewPayment} onClose={() => setReviewPayment(null)} />
    </div>
  </section>;
}
function ResolutionEvidence({ issue, onClose }: { issue: AmountDiscrepancy | null; onClose: () => void }) {
  const data = useQuery({ queryKey: ['resolution-payment', issue?.paymentId, issue?.snapshot], queryFn: () => getPayments().find(payment => payment.id === issue?.paymentId) ?? null, enabled: !!issue });
  return <><PaymentEvidenceReview agencyId={issue?.recipientId ?? ''} evidence={issue && data.data ? { caseId: issue.caseId, payment: data.data, source: issue.source } : null} statementName="Current agency statement" onClose={onClose} /><Dialog open={!!issue && !data.data} onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Payment record</DialogTitle><DialogDescription>{data.isLoading ? 'Loading payment details…' : data.error?.message ?? 'This payment is no longer in the current records. See what was recorded in the payment issue history.'}</DialogDescription></DialogHeader>{data.error && <Button variant="outline" onClick={() => void data.refetch()}>Reload payment details</Button>}<Button variant="outline" onClick={onClose}>Return to payment issues</Button></DialogContent></Dialog></>;
}
