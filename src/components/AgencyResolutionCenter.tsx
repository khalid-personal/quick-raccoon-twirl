import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, CheckCircle2, Clock3, FileSearch, MessageSquare, Scale, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { agencyDecisionLabel, agencyReviewEvidence, verifyAgencyUnderpayment, amountDiscrepancies, autoResolveVerifiedAgencyCases, getAgencyResolutionCases, agencyCaseName, escalateAmountDiscrepancy, decideAgencyCase, appealAgencyCase, type AgencyResolutionCase, type AmountDiscrepancy } from '@/lib/agency-resolution';
import PaymentEvidenceReview from './PaymentEvidenceReview';
import CandidateAvatar from './CandidateAvatar';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { getCandidates, getConfig, getPayments, getStaffUsers } from '@/lib/data-store';
import { submissionDeadline } from '@/lib/submission-policy';
import { usePageMemory } from '@/hooks/use-page-memory';
import { actorDisplayName } from '@/lib/demo-identities';
import { navigationItemClass, navigationRail } from './ui/navigation-rail';
import { foreignUnderpaymentCycle, foreignUnderpaymentStatus } from '@/lib/foreign-underpayment-policy';

const issueSummary = (issue: AmountDiscrepancy) => `${issue.kind === 'underpayment' ? 'Less money than expected' : 'More money than expected'} compared with the ${issue.basis === 'bank' ? 'uploaded bank file' : issue.basis === 'contract' ? 'work contract' : 'candidate stage fee'}`;

export default function AgencyResolutionCenter({ agencyNotice = false, agencyScope }: { agencyNotice?: boolean; agencyScope?: { type: 'local' | 'foreign'; id: string } }) {
  const auth = useAuth();
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;
  const admin = auth.userRole === 'superadmin';
  const actorId = auth.viewAs?.userId ?? auth.user?.id ?? '';
  const practiceStaff = auth.isDemo ? getStaffUsers().find(staff => staff.id === actorId) : undefined;
  const actor = { id: actorId, email: practiceStaff?.email ?? auth.user?.email ?? '', role: auth.userRole ?? '', localAgencyId: auth.userLocalAgencyId, foreignAgencyId: auth.userForeignAgencyId };
  const enabled = admin || auth.userRole === 'local-agency' || auth.userRole === 'staff' && !!auth.userLocalAgencyId || ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(auth.userRole ?? '');
  const data = useQuery({ queryKey: ['agency-resolution', auth.isDemo, auth.user?.id, auth.viewAs?.userId, auth.userRole, auth.userLocalAgencyId, auth.userForeignAgencyId], enabled,
    queryFn: async () => {
      foreignUnderpaymentCycle(getConfig());
      if (admin && actor.id && actor.email) await autoResolveVerifiedAgencyCases(actor);
      return { cases: getAgencyResolutionCases(), issues: admin && !agencyNotice ? amountDiscrepancies() : [] };
    }, refetchInterval: 30000 });
  const refetch = data.refetch;
  useEffect(() => {
    const refresh = () => { if (enabled) void refetch(); };
    window.addEventListener('agency-resolution-changed', refresh); window.addEventListener('bank-statement-changed', refresh); window.addEventListener('supabase-data-changed', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('agency-resolution-changed', refresh); window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [refetch, enabled]);
  const memoryKey = `agency-review:${agencyNotice}:${agencyScope?.type ?? 'all'}:${agencyScope?.id ?? 'all'}`;
  const [selected, setSelected] = usePageMemory<AgencyResolutionCase | AmountDiscrepancy | null>(`${memoryKey}:selected`, null);
  const [reason, setReason] = usePageMemory(`${memoryKey}:reason`, '');
  const [evidenceUrl, setEvidenceUrl] = usePageMemory(`${memoryKey}:evidence-url`, '');
  const [dueDate, setDueDate] = usePageMemory(`${memoryKey}:due-date`, '');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'appeals' | 'suspended' | 'closed'>('all');
  const [showAll, setShowAll] = useState(false);
  const [reviewPayment, setReviewPayment] = useState<AmountDiscrepancy | null>(null);
  const [candidateConfirmed, setCandidateConfirmed] = useState(false);
  const [evidenceSnapshot, setEvidenceSnapshot] = usePageMemory(`${memoryKey}:evidence-snapshot`, '');
  const reviewRef = useRef<HTMLElement>(null);
  const inScope = (issue: AmountDiscrepancy) => !agencyScope || (agencyScope.type === 'local'
    ? issue.recipientId === agencyScope.id
    : issue.agencyType === 'foreign' && issue.agencyId === agencyScope.id);
  const cases = (data.data?.cases ?? []).filter(record => (admin || record.issue.agencyType === 'local' && record.issue.agencyId === auth.userLocalAgencyId && ['local-agency', 'staff'].includes(auth.userRole ?? '')
    || record.issue.agencyType === 'foreign' && record.issue.agencyId === auth.userForeignAgencyId && ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(auth.userRole ?? ''))
    && inScope(record.issue));
  const open = cases.filter(record => record.state !== 'resolved');
  const fresh = (data.data?.issues ?? []).filter(issue => inScope(issue) && !cases.some(record => record.issue.id === issue.id && (record.state !== 'resolved' || record.issue.snapshot === issue.snapshot)));
  const selectedCase = selected && 'issue' in selected ? cases.find(record => record.id === selected.id) : undefined;
  const issue = selectedCase?.issue ?? (selected && !('issue' in selected) ? selected : null);
  const chances = !data.error && data.data && issue?.agencyType === 'foreign' ? foreignUnderpaymentStatus(issue.agencyId, data.data.cases, getConfig()) : null;
  const evidence = issue ? agencyReviewEvidence(issue) : null;
  const evidenceStale = !!evidence && evidence.snapshot !== evidenceSnapshot;
  const reviewOpen = !!selected && !!issue;
  const reviewStage = selectedCase?.state === 'resolved' ? 'closed' : selectedCase?.state === 'appealed' ? 'appeals' : selectedCase?.holdActive ? 'suspended' : selectedCase ? 'waiting' : 'new';
  const select = (item: AgencyResolutionCase | AmountDiscrepancy) => {
    setSelected(item); setReason(''); setEvidenceUrl(''); setDueDate(''); setCandidateConfirmed(false);
    setEvidenceSnapshot(agencyReviewEvidence('issue' in item ? item.issue : item).snapshot);
    try { setDueDate('issue' in item ? item.dueDate : submissionDeadline(getConfig()).end); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not read submission dates.'); }
  };
  useEffect(() => {
    if (selected) {
      reviewRef.current?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
      reviewRef.current?.focus({ preventScroll: true });
    }
  }, [selected, reviewOpen]);
  const execute = async (action: 'verify-underpayment' | 'escalate' | 'suspend' | 'request-follow-up' | 'reject-appeal' | 'reinstate' | 'resolve' | 'appeal') => {
    if (!issue) return;
    setBusy(true);
    try {
      if (action === 'verify-underpayment') {
        if (!candidateConfirmed) throw new Error('Confirm that you reviewed the candidate and bank credit first.');
        const record = await verifyAgencyUnderpayment(issue.id, evidenceSnapshot, reason, dueDate, actor);
        setSelected(record); setCandidateConfirmed(false);
      }
      else if (action === 'escalate') { const record = await escalateAmountDiscrepancy(issue.id, reason, dueDate, actor); setSelected(record); }
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
    { id: 'suspended', title: 'Agency paused', subtitle: 'Verified shortfall or recorded decision', icon: ShieldAlert, color: 'border-rose-500/25 bg-rose-500/5', items: suspended },
    { id: 'appeals', title: 'Appeals to review', subtitle: 'Read the agency’s explanation', icon: MessageSquare, color: 'border-violet-500/25 bg-violet-500/5', items: filter === 'suspended' ? appeals.filter(record => record.holdActive) : appeals },
    { id: 'closed', title: 'Closed cases', subtitle: 'Decisions kept for reference', icon: CheckCircle2, color: 'border-emerald-500/25 bg-emerald-500/5', items: cases.filter(record => record.state === 'resolved') },
  ].filter(column => filter === 'all' && column.id !== 'closed' || filter === 'appeals' && column.id === 'appeals' || filter === 'suspended' && (column.id === 'suspended' || column.id === 'appeals') || filter === 'closed' && column.id === 'closed')
    .filter(column => admin && !agencyNotice || column.id !== 'new');
  const payments = getPayments();
  const candidates = getCandidates();
  const reviewerName = actorDisplayName(actor.id, actor.email, candidates);
  const caseCard = (item: AgencyResolutionCase | AmountDiscrepancy) => {
    const record = 'issue' in item ? item : undefined;
    const currentIssue = 'issue' in item ? item.issue : item;
    const payment = payments.find(payment => payment.id === currentIssue.paymentId);
    return <article key={record?.id ?? currentIssue.id} className="group space-y-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background"><Building2 className="h-5 w-5 text-muted-foreground" /></span><Badge variant={currentIssue.kind === 'underpayment' ? 'outline' : 'secondary'} className="text-xs">{currentIssue.kind === 'underpayment' ? 'Below expected' : 'Above expected'}</Badge></div>
      <div><p className="text-base font-semibold leading-snug">{agencyCaseName(currentIssue)}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{issueSummary(currentIssue)}</p></div>
      {payment && <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Recorded payment</p><p className="mt-1 text-lg font-semibold tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{payment.receipt_number || payment.provider_reference || payment.id}</p><p className="mt-2 text-xs">{payment.candidate_ids.map(id => { const candidate = candidates.find(item => item.id === id); return candidate ? `${candidate.first_name} ${candidate.last_name} · ${candidate.tracking_code}` : `Candidate unavailable (${id})`; }).join(', ') || 'No candidate assigned'}</p></div>}
      {record && <div className="flex flex-wrap gap-2"><Badge variant={record.holdActive ? 'destructive' : 'secondary'}>{record.state === 'resolved' ? 'Issue closed' : record.holdActive ? 'New agency activity paused' : record.state === 'appealed' ? 'Agency reply received' : 'Awaiting agency reply'}</Badge>{record.state === 'appealed' && <Badge variant="outline">Appeal waiting for review</Badge>}<p className="w-full text-xs text-muted-foreground">{record.state === 'resolved' ? `Updated ${record.updatedAt.slice(0, 10)}` : record.state === 'appealed' ? `Original reply deadline ${record.dueDate}` : `Reply by ${record.dueDate}`}</p>{record.state !== 'resolved' && record.state !== 'appealed' && record.dueDate < new Date().toISOString().slice(0, 10) && <Badge variant="destructive">Reply overdue</Badge>}</div>}
      <Button disabled={busy} aria-controls={fieldId('review-workspace')} aria-expanded={selected === item || !!record && selectedCase?.id === record.id} className="w-full justify-between rounded-xl" size="sm" variant="outline" onClick={() => select(item)}>{record ? admin ? 'Review this issue' : 'Explain or appeal' : 'Review difference'}<ArrowUpRight className="h-4 w-4" /></Button>
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
    <details className="rounded-2xl border bg-background/60 p-4 text-sm"><summary className="cursor-pointer font-semibold">How reviews and agency suspensions work</summary><p className="mt-3 leading-relaxed text-muted-foreground">Differences concern foreign agency transfers to local agencies, not candidate ChechePay payments. After the candidate, exact reference and bank shortfall are verified, the sending foreign agency uses one of three chances. The first two require payment follow-up; the third pauses new activity. A transfer cannot use another chance in the same cycle. Missing or reused references, shared payments, different currencies, unsafe files and contract estimates do not qualify.</p><p className="mt-3 text-muted-foreground">The ministry may explicitly pause an agency sooner. Releasing that pause preserves used chances: after one verified underpayment, two remain. The ministry renewal date restores three chances but never clears a pause. Existing candidate support and appeals remain available. This is a portal restriction, not a legal finding or provider freeze.</p></details>
    <div role="group" aria-label="Agency case filter" className={navigationRail}>{(['all', 'appeals', 'suspended', 'closed'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} className={navigationItemClass(filter === value)} onClick={() => setFilter(value)}>{value === 'all' ? 'All open cases' : value === 'appeals' ? 'Appeals' : value === 'closed' ? 'Closed cases' : 'Suspended agencies'}</button>)}</div>
    {admin && !agencyNotice && filter === 'all' && <p className="text-xs leading-relaxed text-muted-foreground">New differences are warnings, not opened cases or proof of wrongdoing. Review the records and start a documented follow-up to open a case. Changing stages requires a recorded decision, never a drag-and-drop shortcut.</p>}
    <div aria-label="Payment issue stages" className={`grid items-start gap-4 ${columns.length > 2 ? 'md:grid-cols-2 2xl:grid-cols-4' : 'md:grid-cols-2'}`}>{columns.map(({ id, title, subtitle, icon: Icon, color, items }) => <section key={id} aria-label={title} className={`min-w-0 rounded-2xl border ${color}`}>
      <header className="flex items-start justify-between gap-2 border-b border-inherit p-4"><div><h4 className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" />{title}</h4><p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p></div><span className="rounded-lg border border-inherit bg-background/70 px-2 py-1 text-xs font-semibold tabular-nums">{items.length}</span></header>
      <div className="space-y-3 p-3">{(showAll ? items : items.slice(0, 6)).map(caseCard)}{!items.length && <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center"><Icon className="h-6 w-6 text-muted-foreground/40" /><p className="text-xs text-muted-foreground">No items at this stage</p></div>}</div>
    </section>)}</div>
    {!open.length && !fresh.length && !data.error && !data.isLoading && <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5"><CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" /><div><p className="font-semibold">No payment issues need review.</p><p className="mt-1 text-sm text-muted-foreground">There are no open cases{admin ? ' or detected amount differences' : ''} in these records.{auth.isDemo && ' Demo High is meant to be clear. Choose a lower demo example in Settings to practice reviewing problems.'}</p></div></div>}
    {!showAll && columns.some(column => column.items.length > 6) && <Button variant="ghost" onClick={() => setShowAll(true)}>Show all payment issues</Button>}
    {selected && issue && <section ref={reviewRef} tabIndex={-1} id={fieldId('review-workspace')} aria-label="Difference review workspace" className="scroll-mt-24 overflow-hidden rounded-3xl border border-primary/25 bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-200">Candidate payment review</p><h4 className="mt-2 text-xl font-bold">{agencyCaseName(issue)} · payment issue</h4><p className="mt-2 max-w-2xl text-sm text-white/60">Compare the candidate, receipt and bank credit here. A verified shortfall pauses new activity; an appeal never lifts that pause without an administrator’s decision.</p><p className="mt-3 break-all text-xs text-sky-100/70">Reviewing as {reviewerName}{actor.email !== reviewerName ? ` · ${actor.email}` : ''}</p></div><Button disabled={busy} variant="secondary" onClick={() => { setSelected(null); setReviewPayment(null); }}>Close review</Button></header>
      <div className="space-y-5 p-5">
      <ol aria-label="Case lifecycle" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">{[
        { id: 'new', title: 'Check differences', Icon: FileSearch },
        { id: 'waiting', title: 'Wait for a reply', Icon: Clock3 },
        { id: 'suspended', title: 'Agency paused', Icon: ShieldAlert },
        { id: 'appeals', title: 'Review appeal', Icon: MessageSquare },
        { id: 'closed', title: 'Resolution recorded', Icon: CheckCircle2 },
      ].map(({ id, title, Icon }, index) => <li key={id} aria-current={reviewStage === id ? 'step' : undefined} className={`rounded-2xl border p-4 ${reviewStage === id ? 'border-primary/40 bg-primary/10' : 'bg-muted/30 text-muted-foreground'}`}><Icon className="mb-3 h-5 w-5" /><p className="text-[10px] uppercase tracking-widest">Stage {index + 1}{reviewStage === id ? ' · Current' : ''}</p><p className="mt-1 text-sm font-semibold">{title}</p></li>)}</ol>
      <p className="text-xs text-muted-foreground">The first two distinct verified foreign underpayments use a chance and open follow-up. The third pauses the sending agency. The ministry can record an earlier pause; appeals and releases keep used chances until the ministry renewal date.</p>
      {admin && evidence && evidenceStale && (!selectedCase || selectedCase.state === 'escalated' && !selectedCase.holdActive) && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="text-sm">The candidate or bank records changed while this review was open. Check the updated comparison before confirming an automatic pause.</p><Button variant="outline" className="mt-3" disabled={busy} onClick={() => { setEvidenceSnapshot(evidence.snapshot); setCandidateConfirmed(false); }}>Review updated comparison</Button></div>}
      {evidence && <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border p-4"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Candidate</p>{evidence.candidate && <CandidateAvatar candidate={evidence.candidate} className="mt-4 h-14 w-14" />}<p className="mt-3 text-lg font-bold">{evidence.candidate ? `${evidence.candidate.first_name} ${evidence.candidate.last_name}` : 'Shared or unassigned payment'}</p><p className="mt-2 break-all font-mono text-sm">{evidence.candidate?.tracking_code ?? 'Check each candidate allocation separately'}</p><p className="mt-3 text-xs text-muted-foreground">{agencyCaseName(issue)}</p></div>
        <div className="rounded-2xl border p-4"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recorded receipt</p><p className="mt-3 text-2xl font-bold tabular-nums">{evidence.payment ? `${evidence.payment.amount.toLocaleString()} ${evidence.payment.currency}` : 'Payment unavailable'}</p><p className="mt-2 break-all font-mono text-xs">{evidence.payment?.provider_reference || evidence.payment?.receipt_number || 'Reference not supplied'}</p><p className="mt-3 text-xs text-muted-foreground">Status: {evidence.payment?.status ?? 'Unavailable'}</p></div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Bank credit</p><p className="mt-3 text-2xl font-bold tabular-nums">{evidence.line ? `${evidence.line.amount.toLocaleString()} ${evidence.line.currency}` : 'Exact bank link not confirmed'}</p><p className="mt-2 break-all font-mono text-xs">{evidence.line?.reference ?? 'One exact reference is required'}</p><p className="mt-3 text-xs text-muted-foreground">{evidence.statementName ?? 'No bank file supplied'}{evidence.practice ? ' · Practice evidence, not a real bank confirmation' : ''}</p>{evidence.line && evidence.payment && evidence.line.currency.toUpperCase() === evidence.payment.currency.toUpperCase() && <p className="mt-3 text-sm font-semibold">Difference: {(evidence.line.amount - evidence.payment.amount).toLocaleString()} {evidence.payment.currency}</p>}</div>
      </div>}
      {chances && <section aria-label="Foreign agency underpayment chances" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h5 className="font-semibold">{chances.remaining} of 3 chances remaining · {agencyCaseName(issue)}</h5>
        <p className="mt-2 text-sm">{chances.used} distinct verified underpayments in this cycle. {chances.renewsOn ? chances.renewed ? `Renewed ${chances.renewsOn}; the ministry must set the next date.` : `Renews ${chances.renewsOn} at midnight Ethiopia time.` : 'The ministry has not set a renewal date.'}</p>
        <p className="mt-2 text-xs text-muted-foreground">An appeal or ministry release does not reset used chances. Renewal does not lift an active pause.</p>
      </section>}
      {admin && evidence && <section aria-label="Automatic pause checks" className="rounded-2xl border p-4"><h5 className="font-semibold">Verify before using an underpayment chance</h5>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{evidence.checks.map(check => <div key={check.title} className="flex items-start gap-3 rounded-xl bg-muted/30 p-3"><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${check.passed ? 'bg-emerald-500' : 'bg-amber-500'}`} /><div><p className="text-sm font-semibold">{check.title} · {check.passed ? 'Passed' : 'Needs review'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.detail}</p></div></div>)}</div>
        <p className="mt-4 text-sm">{selectedCase?.holdActive ? 'The agency pause remains active. Only an administrator’s recorded reinstatement decision can remove it.' : selectedCase?.state === 'resolved' ? 'This case is closed. The saved decision and original issue remain in its history.' : selectedCase?.state === 'appealed' ? 'Review the agency’s explanation before recording the next decision.' : evidence.canAutoPause ? `All record checks pass. Confirm to use one chance${chances && chances.remaining <= 1 ? ' and pause new foreign agency activity' : ' and request the missing amount'}.` : 'Automatic pause is blocked. Use documented follow-up to ask for missing evidence or an explanation.'}</p>
      </section>}
      {issue && <><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="font-semibold">{selectedCase ? 'Original issue recorded' : 'Difference to investigate'}</p><p className="mt-2 text-sm">{issueSummary(issue)}</p><p className="mt-2 text-sm">{issue.explanation}</p>{selectedCase && !evidence?.checks[0].passed && <p className="mt-3 text-xs font-semibold">The current records differ from this saved issue. Review the comparison above and the decision history before taking another action.</p>}</div>
        {admin && <Button variant="outline" onClick={() => setReviewPayment(issue)}>View receipt and bank records</Button>}
        {!selectedCase && <div><Label htmlFor={fieldId('resolution-due')}>Reply deadline</Label><Input type="date" id={fieldId('resolution-due')} data-field="resolution-due" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>}
        <div><Label htmlFor={fieldId('resolution-reason')}>{admin ? 'Reason for this decision or follow-up (at least 10 characters)' : 'Your explanation or appeal (at least 10 characters)'}</Label><Textarea id={fieldId('resolution-reason')} data-field="resolution-reason" value={reason} onChange={event => setReason(event.target.value)} /></div>
        {!admin && <div><Label htmlFor={fieldId('resolution-url')}>Link to supporting proof (optional)</Label><Input id={fieldId('resolution-url')} data-field="resolution-url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://" /></div>}
        {admin && chances && !chances.countedPayments.has(issue.paymentId) && (!selectedCase || selectedCase.state === 'escalated' && !selectedCase.holdActive) && <div className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4"><Label className="flex items-start gap-3"><input type="checkbox" checked={candidateConfirmed} onChange={event => setCandidateConfirmed(event.target.checked)} disabled={!evidence?.canAutoPause || evidenceStale || busy} className="mt-1 h-4 w-4" /><span>I have checked the candidate, exact bank reference and credit amount. Record one verified underpayment chance against the sending foreign agency.</span></Label><Button variant={chances.remaining <= 1 ? 'destructive' : 'default'} disabled={busy || !!data.error || !candidateConfirmed || !evidence?.canAutoPause || evidenceStale || reason.trim().length < 10 || !dueDate} onClick={() => void execute('verify-underpayment')}>{chances.remaining <= 1 ? 'Confirm third underpayment and pause agency' : 'Confirm underpayment and use one chance'}</Button></div>}
        <div className="flex flex-wrap gap-2">{!selectedCase && admin ? <Button disabled={busy || reason.trim().length < 10 || !dueDate} onClick={() => void execute('escalate')}>Start documented follow-up</Button> : admin && selectedCase ? <><Button variant="outline" disabled={busy || reason.trim().length < 10 || selectedCase.state === 'resolved'} onClick={() => void execute('request-follow-up')}>Ask agency for more information</Button>        <Button variant="destructive" disabled={busy || reason.trim().length < 10 || selectedCase.holdActive || selectedCase.state === 'resolved' || selectedCase.issue.basis === 'stage-fee'} onClick={() => void execute('suspend')}>Pause new activity for this agency</Button>{selectedCase.state === 'appealed' && <Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => void execute('reject-appeal')}>{selectedCase.holdActive ? 'Decline appeal and keep suspension' : 'Decline appeal and continue follow-up'}</Button>}{selectedCase.holdActive ? <Button disabled={busy || reason.trim().length < 10} onClick={() => void execute('reinstate')}>Accept explanation and lift suspension</Button> : <Button disabled={busy || reason.trim().length < 10 || selectedCase.state === 'resolved'} onClick={() => void execute('resolve')}>Close issue with an explanation</Button>}</> : <Button disabled={busy || reason.trim().length < 10 || selectedCase?.state === 'resolved'} onClick={() => void execute('appeal')}>Send explanation or appeal</Button>}</div>
        {selectedCase?.issue.basis === 'stage-fee' && <p className="text-sm text-muted-foreground">A candidate’s unpaid stage fee alone cannot be used to suspend an agency.</p>}
        {selectedCase && <section aria-label="Appeal and decision history" className="rounded-2xl border p-5"><h5 className="font-semibold">Appeal and decision history</h5><ol className="mt-5 space-y-4 border-l border-primary/20 pl-5">{[...selectedCase.events].reverse().map(event => <li key={event.id} className="relative rounded-xl bg-muted/40 p-4"><span aria-hidden="true" className="absolute -left-[25px] top-5 h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-semibold">{agencyDecisionLabel(event.action)}</p><p className="mt-1 break-all text-xs text-muted-foreground">{actorDisplayName(event.actorId, event.actor, candidates)} · {new Date(event.at).toLocaleString()}</p><p className="mt-3 text-sm leading-relaxed">{event.reason}</p>{event.evidenceUrl && <a href={event.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-primary underline">Supporting proof</a>}<p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">Decision record {event.auditId}</p></li>)}</ol></section>}
      </>}
      </div>
    </section>}
    <ResolutionEvidence issue={reviewPayment} onClose={() => setReviewPayment(null)} />
    </div>
  </section>;
}
function ResolutionEvidence({ issue, onClose }: { issue: AmountDiscrepancy | null; onClose: () => void }) {
  const data = useQuery({ queryKey: ['resolution-payment', issue?.paymentId, issue?.snapshot], queryFn: () => getPayments().find(payment => payment.id === issue?.paymentId) ?? null, enabled: !!issue });
  if (!issue) return null;
  if (!data.data) return <div role={data.isLoading ? 'status' : 'alert'} className="rounded-xl border p-4"><p>{data.isLoading ? 'Loading payment details…' : data.error?.message ?? 'This payment is no longer in the current records. See what was recorded in the payment issue history.'}</p>{data.error && <Button variant="outline" onClick={() => void data.refetch()}>Reload payment details</Button>}<Button variant="outline" onClick={onClose}>Return to payment issues</Button></div>;
  return <PaymentEvidenceReview agencyId={issue.recipientId} evidence={{ caseId: issue.caseId, payment: data.data, source: issue.source }} statementName="Current agency statement" onClose={onClose} />;
}
