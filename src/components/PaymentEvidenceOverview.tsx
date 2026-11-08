import { ArrowRight, BadgeCheck, CircleHelp, FileCheck2, FileQuestion, Landmark, ReceiptText, Scale, TriangleAlert } from 'lucide-react';
import type { PaymentEvidence } from './PaymentEvidenceReview';
import { getCandidates, getForeignAgencies, getLocalAgencies } from '@/lib/data-store';
import { PAYMENT_STATUS_LABELS } from '@/lib/payment-ledger';
import { Badge } from '@/components/ui/badge';
import CandidateAvatar from './CandidateAvatar';
import { cn } from '@/lib/utils';
import { evidenceReviewStatus } from '@/lib/payment-evidence-status';

export default function PaymentEvidenceOverview({ evidence, statementName }: { evidence: PaymentEvidence; statementName: string }) {
  const payment = evidence.payment ?? evidence.match?.payment;
  const line = evidence.match?.line ?? evidence.line;
  const match = evidence.match;
  const comparable = !!payment && !!line && !!line.currency && line.currency.toUpperCase() === payment.currency.toUpperCase();
  const difference = comparable ? line.amount - payment.amount : undefined;
  const status = evidenceReviewStatus(payment, match);
  const confirmed = status === 'settled';
  const failed = status === 'failed';
  const referenceConfirmed = match?.matchBasis === 'reference' && !match.currencyMismatch;
  const amount = (value?: number, currency?: string) => value === undefined ? 'Not available' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || 'currency unknown'}`;
  const candidates = getCandidates().filter(candidate => payment?.candidate_ids.includes(candidate.id) || evidence.candidateId === candidate.id);
  const payer = evidence.expected?.payer || payment?.payer_display_name
    || getForeignAgencies().find(agency => agency.id === payment?.payer_foreign_agency_id)?.name
    || candidates.map(candidate => `${candidate.first_name} ${candidate.last_name}`).join(', ') || 'Payer not recorded';
  const payee = evidence.expected?.payee || getLocalAgencies().find(agency => agency.id === payment?.payee_local_agency_id)?.name || 'Local agency not recorded';
  const title = confirmed ? 'Payment and bank-file details match'
    : match?.status === 'short' ? 'Uploaded file shows less than the payment record'
      : match?.status === 'over' ? 'Uploaded file shows more than the payment record'
        : match?.status === 'currency-mismatch' || (!!line && !comparable && !!payment) ? 'Check the currency first'
          : match?.status === 'missing' ? 'No matching deposit was found in the uploaded file'
            : match?.status === 'reference-mismatch' ? 'The deposit needs a reference check'
              : !payment ? 'Payment proof is needed'
                : payment.status !== 'succeeded' ? `Payment is ${PAYMENT_STATUS_LABELS[payment.status].toLowerCase()}`
                  : 'We have not confirmed a matching entry in the uploaded bank file';
  const next = confirmed ? 'No bank difference found. A separate fee or contract issue may still need review.'
    : !line ? 'Ask for a deposit slip or upload the correct bank file. No matching entry here does not prove the money was never paid.'
      : !comparable ? 'Confirm the original currency. These amounts must not be subtracted or converted to claim a match.'
        : !referenceConfirmed ? 'Check the deposit reference and payer before linking this bank row to the payment.'
          : difference !== 0 ? 'Ask the sending foreign agency to explain the difference and supply supporting proof.'
            : 'Check the source details before closing this case.';
  const bankRatio = comparable && payment.amount > 0 ? line.amount / payment.amount * 100 : undefined;
  const checks = [
    { label: 'Payment receipt', done: payment?.status === 'succeeded', text: payment ? PAYMENT_STATUS_LABELS[payment.status] : 'No payment recorded', icon: ReceiptText },
    { label: 'Deposit entry in uploaded file', done: !!line, text: line ? 'From the file; not confirmed by the bank' : 'No matching entry found', icon: Landmark },
    { label: 'Amount & payment reference', done: confirmed, text: confirmed ? 'Details match' : 'Needs checking', icon: FileCheck2 },
  ];
  return <div className="space-y-5">
    <section className={cn('rounded-2xl border p-5 transition-colors duration-300 motion-reduce:transition-none', confirmed ? 'border-emerald-500/30 bg-emerald-500/5' : failed ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5')} aria-label="Payment comparison summary">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', confirmed ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600')}>{confirmed ? <BadgeCheck className="h-7 w-7" /> : <TriangleAlert className="h-7 w-7" />}</span>
        <div className="min-w-0"><h3 className="text-xl font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{next}</p>{evidence.issue && <Badge variant="outline" className="mt-2">{evidence.issue}</Badge>}</div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-background p-4"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ReceiptText className="h-4 w-4" />Amount on payment record</p><p className="mt-2 text-2xl font-semibold tabular-nums">{amount(payment?.amount, payment?.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{payment ? PAYMENT_STATUS_LABELS[payment.status] : 'No payment recorded'}</p></div>
        <div className="rounded-xl border bg-background p-4"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="h-4 w-4" />Amount in uploaded bank file</p><p className="mt-2 text-2xl font-semibold tabular-nums">{line ? amount(line.amount, line.currency) : 'No matching entry'}</p><p className="mt-1 text-xs text-muted-foreground">{line ? line.date : 'No matching entry was found; this is not an assumed zero'}</p></div>
        <div className={cn('rounded-xl border p-4', difference === 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'bg-background')}><p className="flex items-center gap-2 text-xs text-muted-foreground"><Scale className="h-4 w-4" />Difference: uploaded file minus receipt</p><p className="mt-2 text-2xl font-semibold tabular-nums">{difference === undefined ? 'Cannot compare' : amount(Math.abs(difference), payment?.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{difference === undefined ? 'Both amounts and currencies are needed' : difference < 0 ? 'Less in the uploaded file' : difference > 0 ? 'More in the uploaded file' : 'Same amount'}</p></div>
      </div>
      {bankRatio !== undefined && <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs"><span>Amount in uploaded file compared with payment record</span><span className="font-semibold">{Math.round(bankRatio)}%</span></div>
        <div role="img" aria-label={`Bank contains ${Math.round(bankRatio)}% of the recorded amount; reference matching is checked separately`} className="h-3 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', confirmed ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.max(0, Math.min(100, bankRatio))}%` }} /></div>
      </div>}
      {evidence.expected && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-background/70 p-3 text-sm"><CircleHelp className="h-4 w-4 text-primary" /><span>Required fee or contract amount: <strong>{amount(evidence.expected.amount, evidence.expected.currency)}</strong> per candidate{evidence.stageTitle ? ` · ${evidence.stageTitle}` : ''}. This is checked separately from the bank file.</span></div>}
    </section>
    <div className="grid gap-3 sm:grid-cols-3">
      {checks.map(({ label, done, text, icon: Icon }, index) => <div key={label} className={cn('flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none', done ? 'border-emerald-500/30 bg-emerald-500/5' : failed ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5')}><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', done ? 'bg-emerald-500/10 text-emerald-600' : failed ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600 motion-safe:animate-pulse')}><Icon className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{index + 1}. {label}</p><p className="text-xs text-muted-foreground">{text}</p><p className="text-[10px] font-semibold uppercase">{done ? 'Success' : failed ? 'Failed' : 'Pending'}</p></div></div>)}
    </div>
    <section className="rounded-xl border p-4" aria-label="Payment route">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Who pays</p><p className="break-words font-semibold">{payer}</p></div>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Who receives</p><p className="break-words font-semibold">{payee}</p></div>
      </div>
      {!!candidates.length && <div className="mt-4 flex flex-wrap gap-3 border-t pt-3">{candidates.map(candidate => <div key={candidate.id} className="flex items-center gap-2"><CandidateAvatar candidate={candidate} className="h-10 w-10" /><div><p className="text-sm font-medium">{candidate.first_name} {candidate.last_name}</p><p className="font-mono text-[10px] text-muted-foreground">{candidate.tracking_code}</p></div></div>)}</div>}
    </section>
    <details className="rounded-xl border p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><FileQuestion className="h-4 w-4" />Receipt and uploaded bank details</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="py-2">Check</th><th>Receipt</th><th>Bank</th></tr></thead><tbody>
        {[
          ['Reference', match?.matchedReference || payment?.provider_reference || payment?.receipt_number, line?.reference],
          ['Date', payment?.created_at.slice(0, 10), line?.date],
          ['Currency', payment?.currency, line?.currency],
          ['Source', payment?.payment_method || payment?.provider, statementName],
          ['Description', payment?.receipt_number, line?.description],
        ].map(([label, recorded, bank]) => <tr key={label} className="border-b last:border-0"><th className="py-3 pr-3">{label}</th><td className="max-w-64 break-words pr-3">{recorded || 'Not recorded'}</td><td className="max-w-64 break-words">{bank || 'Not supplied'}</td></tr>)}
      </tbody></table></div>
      <p className="mt-3 text-xs text-muted-foreground">{evidence.explanation || match?.explanation || 'No bank match has been confirmed for this record.'}</p>
      {match && <p className="mt-2 text-xs text-muted-foreground">How the records were linked: {match.matchBasis === 'reference' ? 'Payment reference' : match.matchBasis === 'amount-date' ? 'Similar amount and nearby date only; the payment reference is not confirmed' : 'No matching entry in the uploaded file'}.</p>}
    </details>
  </div>;
}
