import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Clock3, MessageSquare, Scale, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { amountDiscrepancies, autoResolveVerifiedAgencyCases, getAgencyResolutionCases, agencyCaseName, escalateAmountDiscrepancy, decideAgencyCase, appealAgencyCase, type AgencyResolutionCase, type AmountDiscrepancy } from '@/lib/agency-resolution';
import PaymentEvidenceReview from './PaymentEvidenceReview';
import WidgetShell from './WidgetShell';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { getConfig, getPayments } from '@/lib/data-store';
import { submissionDeadline } from '@/lib/submission-policy';

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
  const [filter, setFilter] = useState<'all' | 'appeals' | 'suspended'>('all');
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
      toast.success('Decision recorded and audit logged. No external notice was sent.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not record this decision.'); }
    finally { setBusy(false); }
  };
  if (!enabled || agencyNotice && admin || agencyNotice && !open.length && !data.error) return null;
  const visible = open.filter(record => filter === 'all' || filter === 'appeals' && record.state === 'appealed' || filter === 'suspended' && record.holdActive);
  return <WidgetShell title={admin ? 'Resolve & protect' : 'Agency review & appeals'} description={admin ? 'A guided resolution inbox: check the evidence, follow up, escalate amount gaps and decide restrictions fairly.' : 'Review agency notices and submit an explanation. Appeals never remove a suspension until the superadmin decides.'} icon={Scale} accent="rose" bodyClassName="space-y-4">
    {data.error && <div role="alert" className="rounded-xl border border-destructive p-3"><p>{data.error.message}</p><Button variant="outline" onClick={() => void data.refetch()}>Retry cases</Button></div>}
    {data.isLoading && <p role="status">Loading resolution cases…</p>}
    <div className="grid grid-cols-3 gap-3">{[{ label: 'Open cases', value: open.length, Icon: Clock3 }, { label: 'Agency holds', value: open.filter(record => record.holdActive).length, Icon: ShieldAlert }, { label: 'Appeals to review', value: open.filter(record => record.state === 'appealed').length, Icon: MessageSquare }].map(({ label, value, Icon }) => <div key={label} className="rounded-xl border bg-background p-3"><Icon className="mb-2 h-5 w-5 text-rose-600" /><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}</div>
    <p className="text-sm text-muted-foreground">Suspension pauses new registration, new agency assignment/profile sharing and foreign settlement in this portal. Existing support, historical records, appeal access and candidate payments remain available. This is not a legal finding or a provider-level account freeze.</p>
    <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">Fully checked receipts are automatically green-cleared. This inbox keeps only open flags and holds; correcting money evidence never silently reinstates a suspended agency.</p>
    <div className="flex flex-wrap gap-2">{(['all', 'appeals', 'suspended'] as const).map(value => <Button size="sm" key={value} variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{value === 'all' ? 'All open cases' : value === 'appeals' ? 'Appeals' : 'Suspended agencies'}</Button>)}</div>
    {(showAll ? visible : visible.slice(0, 8)).map(record => <article key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{agencyCaseName(record.issue)}</p><p className="text-sm text-muted-foreground">{record.issue.kind} · {record.issue.basis} check · Follow-up {record.dueDate}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant={record.holdActive ? 'destructive' : 'secondary'}>{record.holdActive ? 'Operations suspended' : 'Escalated / review only'}</Badge><Badge variant="outline">{record.state === 'appealed' ? 'Appeal awaiting decision' : record.state}</Badge>{record.dueDate < new Date().toISOString().slice(0, 10) && <Badge variant="destructive">Follow-up overdue</Badge>}</div></div><Button size="sm" variant="outline" onClick={() => select(record)}>{admin ? 'Review & decide' : 'Explain / appeal'}<ArrowUpRight /></Button></article>)}
    {admin && !agencyNotice && <><h4 className="text-lg font-semibold">Amount gaps needing escalation ({fresh.length})</h4><p className="text-sm text-muted-foreground">These are signals to investigate, not proof that an agency caused the gap. Ambiguous references, currency mismatches and pending transactions never trigger automatic suspension.</p>{(showAll ? fresh : fresh.slice(0, 8)).map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div><p className="font-semibold">{agencyCaseName(item)}</p><p className="text-sm">{item.kind} · {item.basis} check</p></div><Button size="sm" variant="outline" onClick={() => select(item)}>Investigate & escalate<ArrowUpRight /></Button></article>)}</>}
    {!open.length && !fresh.length && !data.error && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" />No agency resolution cases need action.</p>}
    {!showAll && (visible.length > 8 || fresh.length > 8) && <Button variant="ghost" onClick={() => setShowAll(true)}>Show all resolution items</Button>}
    <Dialog open={!!selected && !reviewPayment} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{issue && agencyCaseName(issue)} · resolution</DialogTitle><DialogDescription>Check facts first, ask for an explanation, then make a reasoned decision. Suspension requires an explicit superadmin decision and remains active during an appeal.</DialogDescription></DialogHeader>
      {issue && <><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="font-semibold capitalize">{issue.kind} · {issue.basis} check</p><p className="mt-2 text-sm">{issue.explanation}</p></div>
        <ol className="grid gap-2 sm:grid-cols-3">{['1. Compare receipt / bank / contract', '2. Request explanation or escalate', '3. Decide, document & follow up'].map(step => <li className="rounded-lg border bg-primary/5 p-3 text-sm font-semibold" key={step}>{step}</li>)}</ol>
        {admin && <Button variant="outline" onClick={() => setReviewPayment(issue)}>View payment & bank evidence</Button>}
        {!selectedCase && <div><Label htmlFor={fieldId('resolution-due')}>Superadmin follow-up deadline</Label><Input type="date" id={fieldId('resolution-due')} data-field="resolution-due" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>}
        <div><Label htmlFor={fieldId('resolution-reason')}>{admin ? 'Decision / follow-up reason (at least 10 characters)' : 'Your explanation / appeal (at least 10 characters)'}</Label><Textarea id={fieldId('resolution-reason')} data-field="resolution-reason" value={reason} onChange={event => setReason(event.target.value)} /></div>
        {!admin && <div><Label htmlFor={fieldId('resolution-url')}>Supporting evidence HTTPS link (optional)</Label><Input id={fieldId('resolution-url')} data-field="resolution-url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://" /></div>}
        <div className="flex flex-wrap gap-2">{!selectedCase && admin ? <Button disabled={busy || reason.trim().length < 10 || !dueDate} onClick={() => void execute('escalate')}>Escalate amount discrepancy · audit logged</Button> : admin && selectedCase ? <><Button variant="outline" disabled={busy || reason.trim().length < 10 || selectedCase.state === 'resolved'} onClick={() => void execute('request-follow-up')}>Request follow-up</Button>        <Button variant="destructive" disabled={busy || reason.trim().length < 10 || selectedCase.holdActive || selectedCase.state === 'resolved' || selectedCase.issue.basis === 'stage-fee'} onClick={() => void execute('suspend')}>Suspend agency operations</Button>{selectedCase.state === 'appealed' && <Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => void execute('reject-appeal')}>Decline appeal · keep restriction</Button>}{selectedCase.holdActive ? <Button disabled={busy || reason.trim().length < 10} onClick={() => void execute('reinstate')}>Accept explanation & reinstate</Button> : <Button disabled={busy || reason.trim().length < 10 || selectedCase.state === 'resolved'} onClick={() => void execute('resolve')}>Resolve with reason</Button>}</> : <Button disabled={busy || reason.trim().length < 10 || selectedCase?.state === 'resolved'} onClick={() => void execute('appeal')}>Submit explanation / appeal</Button>}</div>
        {selectedCase && <><h4 className="font-semibold">Decision timeline</h4><ol className="space-y-3 border-l pl-4">{[...selectedCase.events].reverse().map(event => <li key={event.id}><p className="text-sm font-semibold">{event.action} · {event.actor}</p><p className="text-sm">{event.reason}</p>{event.evidenceUrl && <a href={event.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Supporting evidence</a>}<p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString()} · Audit {event.auditId}</p></li>)}</ol></>}
      </>}
    </DialogContent></Dialog>
    <ResolutionEvidence issue={reviewPayment} onClose={() => setReviewPayment(null)} />
  </WidgetShell>;
}
function ResolutionEvidence({ issue, onClose }: { issue: AmountDiscrepancy | null; onClose: () => void }) {
  const data = useQuery({ queryKey: ['resolution-payment', issue?.paymentId, issue?.snapshot], queryFn: () => getPayments().find(payment => payment.id === issue?.paymentId) ?? null, enabled: !!issue });
  return <><PaymentEvidenceReview agencyId={issue?.recipientId ?? ''} evidence={issue && data.data ? { caseId: issue.caseId, payment: data.data, source: issue.source } : null} statementName="Current agency statement" onClose={onClose} /><Dialog open={!!issue && !data.data} onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Payment evidence</DialogTitle><DialogDescription>{data.isLoading ? 'Loading the linked payment…' : data.error?.message ?? 'The linked payment is no longer available. Review the saved case timeline instead.'}</DialogDescription></DialogHeader>{data.error && <Button variant="outline" onClick={() => void data.refetch()}>Retry payment</Button>}<Button variant="outline" onClick={onClose}>Return to resolution</Button></DialogContent></Dialog></>;
}
