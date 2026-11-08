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
  const title = amountGap ? 'The amounts differ: send this for review' : exact ? 'The details match: record what you checked' : pending ? 'Payment has not been confirmed as received' : 'Ask for the missing payment proof';
  const steps = amountGap ? [
    'Compare the receipt with the bank deposit and the amount owed under the contract. Record how much is missing or extra.',
    'Open Payment issues. Ask the agency to explain the difference and provide deposit slips or refund records before deciding who is responsible.',
    'A superadmin can confirm a uniquely referenced, candidate-linked bank shortfall to apply an agency pause, or record a separate suspension decision. The agency can appeal. Only approved reinstatement lifts the pause.',
  ] : exact ? [
    'Check who paid, who received the money, the candidate, stage and dates. A matching deposit does not complete the candidate’s work.',
    'Record what you checked and how the difference was corrected. Stop reminders only when the supporting records agree.',
    'If a warning remains, check its specific cause. Do not override it just because one receipt matches.',
  ] : [
    pending ? 'Check the payment service’s status and date. Pending, failed or refunded payments do not count as received.' : 'Identify what is missing: receipt, bank deposit, currency, transfer reference or the candidate covered by the payment.',
    'Ask for the missing item. Assign someone to follow up and set a due date.',
    'Check the records again when proof arrives. Send unexplained payment differences or repeated missed deadlines for review. Never create false proof to remove a warning.',
  ];
  return <section aria-label="Investigation helping hand" className={`space-y-4 rounded-2xl border p-5 ${amountGap ? 'border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-orange-500/5' : 'border-primary/20 bg-gradient-to-br from-primary/10 to-emerald-500/5'}`}>
    <div className="flex items-center gap-3">{amountGap ? <ShieldAlert className="h-7 w-7 text-rose-600" /> : <FileSearch className="h-7 w-7 text-primary" />}<div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your next best step</p><h3 className="text-xl font-bold">{title}</h3></div></div>
    <ol className="grid gap-3 md:grid-cols-3">{steps.map((step, index) => <li key={step} className="rounded-xl border bg-card/80 p-4"><span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span><p className="text-sm leading-relaxed">{step}</p></li>)}</ol>
    <div className="flex flex-wrap gap-2"><Button variant={amountGap ? 'outline' : 'default'} onClick={() => onAction(amountGap ? 'escalate' : exact ? 'resolve' : 'request-evidence')}>{exact ? <CheckCircle2 /> : <ClipboardCheck />}{amountGap ? 'Write a review request' : exact ? 'Record how it was fixed' : 'Ask for proof & set a due date'}</Button>{amountGap && userRole === 'superadmin' && <Button asChild><Link to="/admin/payments#resolution" onClick={onLeave}>Open Payment issues<ArrowUpRight /></Link></Button>}</div>
    <p className="text-xs text-muted-foreground">A warning is a reason to check, not proof of wrongdoing. A candidate’s unpaid fee alone does not prove agency misconduct. Appeals and decisions are saved in the activity history. Contact the agency separately; saving here does not send a message.</p>
  </section>;
}
