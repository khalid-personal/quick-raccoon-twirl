import { ArrowDownLeft, ArrowRight, Building2, CheckCircle2, Clock3, FileSearch, Globe2, ReceiptText, RotateCcw, ShieldAlert, Users, Wallet, XCircle } from 'lucide-react';
import type { LocalAgency, Payment } from '@/lib/types';
import { isForeignPayment } from '@/lib/currency';
import { PAYMENT_STATUS_LABELS, summarizeLocalTransfers, summarizePaymentReceipts, type PaymentStatusFilter } from '@/lib/payment-ledger';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { EntityProfileButton } from './CandidateQuickViewProvider';

const statusCards = [
  { status: 'succeeded', label: 'Settled receipts', detail: 'Money recorded as received', icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  { status: 'pending', label: 'Waiting to settle', detail: 'Not counted as money received', icon: Clock3, tone: 'text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10' },
  { status: 'failed', label: 'Failed payments', detail: 'Open the receipt to find the cause', icon: XCircle, tone: 'text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/10' },
  { status: 'refunded', label: 'Refunded payments', detail: 'Kept separate from collections', icon: RotateCcw, tone: 'text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/10' },
] as const;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const currencyTotals = (payments: Payment[]) => Object.entries(payments.reduce<Record<string, number>>((totals, payment) => {
  const currency = payment.currency.trim().toUpperCase();
  totals[currency] = (totals[currency] ?? 0) + payment.amount;
  return totals;
}, {})).map(([currency, amount]) => `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`).join(' · ') || 'No receipts';

export default function PaymentHistoryOverview({ payments, agencies, source = 'all', onList, onReceipt, onEvidence, onResolution, caseCount }: {
  source?: 'all' | 'foreign' | 'candidate';
  payments: Payment[]; agencies: LocalAgency[]; onList: (status: PaymentStatusFilter, source?: 'foreign' | 'candidate') => void;
  onReceipt: (payment: Payment) => void; onEvidence?: () => void; onResolution?: () => void; caseCount?: number;
}) {
  const summary = summarizePaymentReceipts(payments);
  const local = summarizeLocalTransfers(payments);
  const isLocalView = source === 'candidate';
  const candidateReceipts = payments.filter(payment => !isForeignPayment(payment) && payment.status === 'succeeded');
  const pending = payments.filter(payment => payment.status === 'pending').sort((a,b) => a.created_at.localeCompare(b.created_at));
  const recent = [...payments].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,5);
  const recipients = [...new Set(payments.map(payment => payment.payee_local_agency_id))].map(id => {
    const own = payments.filter(payment => payment.payee_local_agency_id === id);
    return { id, name: agencies.find(agency => agency.id === id)?.name ?? 'Recipient not recorded', count: own.length, settled: own.filter(payment => payment.status === 'succeeded').length };
  }).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0,4);
  return <section className="space-y-5" aria-label="Finance overview">
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-950 p-6 text-white md:p-8">
        <div aria-hidden="true" className="absolute -right-10 -top-12 h-56 w-56 rounded-full border-[24px] border-white/5" />
        <div className="relative"><div className="flex items-center gap-3 text-emerald-200"><Wallet className="h-7 w-7" /><p className="text-sm font-semibold uppercase tracking-widest">Money received</p></div>
          <p className="mt-6 text-sm text-white/75">{isLocalView ? 'Local transfers · ETB final' : 'Foreign transfers · USD reference estimate'}</p><h2 className="mt-1 break-words text-4xl font-bold tabular-nums md:text-5xl">{isLocalView ? `${local.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : usd.format(summary.foreignUsd)}</h2>
          <p className="mt-3 max-w-lg text-sm text-white/75">{isLocalView ? `${local.count} settled candidate-to-local transfers at their recorded ETB amounts. No FX conversion or estimate.` : `${summary.convertedCount} settled foreign transfers. Candidate fees are separate below; pending, failed and refunded receipts are excluded.`}</p>
          {isLocalView && <p className="mt-2 text-xs text-white/70">Pending, failed and refunded payments are excluded. Demo records remain synthetic; receipt evidence remains available for review.</p>}
          {isLocalView && local.otherCurrencies.length > 0 && <p role="alert" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Non-ETB candidate receipts require review: {local.otherCurrencies.join(' · ')}. They are not included in the final ETB total.</p>}
          {!isLocalView && !!Object.keys(summary.excludedForeignTotals).length && <p role="status" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">No reference rate: {Object.entries(summary.excludedForeignTotals).map(([currency,total]) => `${total.toLocaleString()} ${currency}`).join(' · ')} not included.</p>}
          <Button className="mt-5 border-white/30 bg-white/10 text-white hover:bg-white/20" variant="outline" onClick={() => onList('succeeded', isLocalView ? 'candidate' : 'foreign')}>{isLocalView ? 'Explore settled local transfers' : 'Explore settled foreign receipts'}<ArrowRight className="ml-2 h-4 w-4" /></Button>
          <details className="mt-4 text-xs text-white/70"><summary className="cursor-pointer">What this total means</summary>{isLocalView ? <p className="mt-2">Final recorded ETB amounts from succeeded candidate payments, not a converted reference value. Open receipts to inspect ChechePay confirmations and supporting evidence; demo receipts are synthetic.</p> : <><p className="mt-2">Reference FX, not live rates or bank-confirmed USD. {Object.entries(summary.rates).map(([currency,rate]) => `1 ${currency} = ${rate.toFixed(6)} USD`).join(' · ')}</p><p className="mt-2">Original settled foreign amounts: {currencyTotals(payments.filter(payment => isForeignPayment(payment) && payment.status === 'succeeded'))}.</p></>}</details>
        </div>
      </div>
      <div className="grid gap-4">
        <article className="rounded-3xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-card p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-sky-500/15 p-3 text-sky-600 dark:text-sky-300"><Users className="h-6 w-6" /></span><div><h3 className="text-lg font-bold">Candidate fee collections</h3><p className="text-sm text-muted-foreground">Original currency · settled receipts only</p></div></div><p className="mt-4 break-words text-2xl font-bold tabular-nums">{currencyTotals(candidateReceipts)}</p><Button variant="ghost" className="mt-2 px-0" onClick={() => onList('succeeded','candidate')}>View {candidateReceipts.length} candidate receipts<ArrowRight className="ml-2 h-4 w-4" /></Button></article>
        <article className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-card p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-500/15 p-3 text-amber-600 dark:text-amber-300"><Clock3 className="h-6 w-6" /></span><div><h3 className="text-lg font-bold">Next to follow up</h3><p className="text-sm text-muted-foreground">{pending.length} pending receipts{pending[0] ? ` · Oldest ${new Date(pending[0].created_at).toLocaleDateString()}` : ' · Nothing waiting'}</p></div></div><p className="mt-3 text-sm text-muted-foreground">Pending amounts: {currencyTotals(pending)}. These have not been counted as collections.</p><Button variant="outline" className="mt-4" onClick={() => onList('pending')}>Open pending payments<ArrowRight className="ml-2 h-4 w-4" /></Button></article>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statusCards.map(({ status, label, detail, icon: Icon, tone }) => <button key={status} onClick={() => onList(status)} className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${tone}`}><Icon className="h-7 w-7 shrink-0" /><div className="min-w-0 flex-1"><p className="text-3xl font-bold tabular-nums">{payments.filter(payment => payment.status === status).length}</p><p className="font-semibold">{label}</p><p className="mt-1 text-xs opacity-80">{detail}</p></div><ArrowRight className="h-4 w-4" /></button>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <section className="rounded-3xl border bg-card p-5 md:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl font-bold"><ReceiptText className="h-5 w-5 text-primary" />Latest receipts</h3><p className="text-sm text-muted-foreground">Click a receipt to see its story and evidence.</p></div><Button variant="ghost" size="sm" onClick={() => onList('all')}>All payments<ArrowRight className="ml-1 h-4 w-4" /></Button></div><div className="space-y-2">{recent.map(payment => <button key={payment.id} onClick={() => onReceipt(payment)} className="flex w-full items-center gap-3 rounded-2xl border bg-background/50 p-4 text-left hover:border-primary/40 hover:bg-primary/5"><span className="rounded-xl bg-primary/10 p-2 text-primary">{isForeignPayment(payment) ? <Globe2 className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-semibold tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</p><p className="truncate text-xs text-muted-foreground">{payment.payer_display_name || (isForeignPayment(payment) ? 'Foreign agency' : 'Candidate')} · {new Date(payment.created_at).toLocaleDateString()}</p><p className="truncate font-mono text-xs text-muted-foreground">{payment.receipt_number || payment.provider_reference || payment.id}</p></div><Badge variant="outline" className={statusCards.find(item => item.status === payment.status)?.tone}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge></button>)}{!recent.length && <p className="py-8 text-center text-muted-foreground">No payment records in this scope.</p>}</div></section>
      <div className="space-y-5">
        {(onEvidence || onResolution) && <section className="rounded-3xl border border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-card p-6"><h3 className="flex items-center gap-2 text-xl font-bold"><ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-300" />Check & resolve</h3><p className="mt-2 text-sm text-muted-foreground">Compare receipts with bank proof, then investigate gaps. A settled receipt is not automatically a verified bank match.</p><div className="mt-4 flex flex-wrap gap-2">{onEvidence && <Button variant="outline" onClick={onEvidence}><FileSearch className="mr-2 h-4 w-4" />Receipts & bank evidence</Button>}{onResolution && <Button variant="outline" onClick={onResolution}>Resolve & protect{caseCount !== undefined && ` (${caseCount})`}</Button>}</div></section>}
        <section className="rounded-3xl border bg-card p-6"><h3 className="flex items-center gap-2 text-xl font-bold"><Building2 className="h-5 w-5 text-primary" />Where the money goes</h3><p className="mt-1 text-sm text-muted-foreground">Top recipient agencies by receipt count in this scope.</p><div className="mt-4 space-y-3">{recipients.map(recipient => <div key={recipient.id || 'unknown'} className="rounded-xl border bg-background/50 p-3"><div className="flex justify-between gap-3"><EntityProfileButton kind="local-agency" entityId={recipient.id}>{recipient.name}</EntityProfileButton><span className="shrink-0 text-sm tabular-nums">{recipient.settled}/{recipient.count} settled</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${recipient.settled/Math.max(recipient.count,1)*100}%` }} /></div></div>)}{!recipients.length && <p className="text-sm text-muted-foreground">No recipients recorded.</p>}</div></section>
      </div>
    </div>
  </section>;
}
