import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, ClipboardCheck, FileSearch, ShieldAlert } from 'lucide-react';
import type { PaymentMatch } from '@/lib/bank-reconciliation';
import type { Payment } from '@/lib/types';
import { Button } from './ui/button';
import { amountDiscrepancies } from '@/lib/agency-resolution';
import { useAuth } from '@/lib/auth-context';

export default function InvestigationGuide({ payment, match, issue, onAction, onLeave }: { payment?: Payment; match?: PaymentMatch; issue?: string; onAction: (action: 'review' | 'request-evidence' | 'escalate' | 'resolve') => void; onLeave?: () => void }) {
  const { userRole } = useAuth();
  const amountGap = !!payment && amountDiscrepancies().some(item => item.paymentId === payment.id);
  const exact = payment?.status === 'succeeded' && match?.status === 'matched' && !issue;
  const pending = payment?.status !== 'succeeded';
  const title = amountGap ? 'Amount gap: escalate for a fair review' : exact ? 'Evidence lines up: record your conclusion' : pending ? 'Settlement is not confirmed yet' : 'Missing or uncertain proof: ask the right person';
  const steps = amountGap ? [
    'Compare the receipt amount, bank credit, reference and contract allocation. Record which side is short or over.',
    'Escalate to Resolve & protect. Ask the agency for deposit slips, refunds, fees and allocation explanations before deciding responsibility.',
    'The superadmin can impose a reasoned operations hold. The agency can appeal; only an explicit reinstatement lifts that case’s hold.',
  ] : exact ? [
    'Verify payer, receiving agency, candidate/stage and dates. A bank match alone does not complete workflow work.',
    'Record what was checked and how the discrepancy was corrected. Close reminders only when the explanation is supported.',
    'If a warning remains, check its specific cause. Do not override it just because one receipt matches.',
  ] : [
    pending ? 'Check provider status and timestamps. Pending, failed or refunded money does not count as received.' : 'Identify the missing item: receipt, saved bank statement, currency, transfer reference or candidate allocation.',
    'Request the exact missing proof. Choose an owner, submission window and deadline so the follow-up stays visible.',
    'Recompare when proof arrives. Escalate an unresolved amount gap or repeated missed deadline; never invent evidence to clear a flag.',
  ];
  return <section aria-label="Investigation helping hand" className={`space-y-4 rounded-2xl border p-5 ${amountGap ? 'border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-orange-500/5' : 'border-primary/20 bg-gradient-to-br from-primary/10 to-emerald-500/5'}`}>
    <div className="flex items-center gap-3">{amountGap ? <ShieldAlert className="h-7 w-7 text-rose-600" /> : <FileSearch className="h-7 w-7 text-primary" />}<div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your next best step</p><h3 className="text-xl font-bold">{title}</h3></div></div>
    <ol className="grid gap-3 md:grid-cols-3">{steps.map((step, index) => <li key={step} className="rounded-xl border bg-card/80 p-4"><span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span><p className="text-sm leading-relaxed">{step}</p></li>)}</ol>
    <div className="flex flex-wrap gap-2"><Button variant={amountGap ? 'outline' : 'default'} onClick={() => onAction(amountGap ? 'escalate' : exact ? 'resolve' : 'request-evidence')}>{exact ? <CheckCircle2 /> : <ClipboardCheck />}{amountGap ? 'Prepare escalation note' : exact ? 'Document resolution' : 'Ask for proof & set deadline'}</Button>{amountGap && userRole === 'superadmin' && <Button asChild><Link to="/admin/payments#resolution" onClick={onLeave}>Open Resolve & protect<ArrowUpRight /></Link></Button>}</div>
    <p className="text-xs text-muted-foreground">A rule flag is a lead, not a verdict. Candidate unpaid fees alone do not establish agency misconduct. Appeals and decisions are audit logged; external communication must be sent separately.</p>
  </section>;
}
