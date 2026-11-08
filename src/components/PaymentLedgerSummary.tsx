import { ArrowDownLeft, CheckCircle2, Clock3, ListFilter, TriangleAlert } from 'lucide-react';
import { PAYMENT_STATUS_LABELS, summarizeLocalTransfers, summarizePaymentReceipts, type PaymentStatusFilter } from '@/lib/payment-ledger';
import type { Payment } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusOptions = [
  { key: 'all', label: 'All transactions', icon: ListFilter, tone: 'text-foreground', bar: 'bg-muted' },
  { key: 'succeeded', label: PAYMENT_STATUS_LABELS.succeeded, icon: CheckCircle2, tone: 'text-emerald-600', bar: 'bg-emerald-500' },
  { key: 'pending', label: PAYMENT_STATUS_LABELS.pending, icon: Clock3, tone: 'text-amber-600', bar: 'bg-amber-500' },
  { key: 'failed', label: PAYMENT_STATUS_LABELS.failed, icon: TriangleAlert, tone: 'text-rose-600', bar: 'bg-rose-500' },
  { key: 'refunded', label: PAYMENT_STATUS_LABELS.refunded, icon: ArrowDownLeft, tone: 'text-muted-foreground', bar: 'bg-slate-400' },
] satisfies Array<{ key: PaymentStatusFilter; label: string; icon: typeof ListFilter; tone: string; bar: string }>;

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function PaymentLedgerSummary({ payments, source = 'all', status, onStatusChange }: {
  source?: 'all' | 'foreign' | 'candidate';
  payments: Payment[]; status: PaymentStatusFilter; onStatusChange: (status: PaymentStatusFilter) => void;
}) {
  const summary = summarizePaymentReceipts(payments);
  const local = summarizeLocalTransfers(payments);
  const count = (key: PaymentStatusFilter) => key === 'all' ? payments.length : payments.filter(payment => payment.status === key).length;
  return <section className="space-y-3" aria-label="Payment overview">
    <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {statusOptions.filter(item => item.key !== 'all').map(item => <span key={item.key} className={item.bar} style={{ width: `${count(item.key) / Math.max(payments.length, 1) * 100}%` }} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {statusOptions.map(item => <button key={item.key} type="button" aria-pressed={status === item.key}
            onClick={() => onStatusChange(status === item.key ? 'all' : item.key)}
            className={cn('min-w-0 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', status === item.key && 'border-primary bg-primary/5')}>
            <item.icon className={cn('mb-2 h-4 w-4', item.tone)} />
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-xl font-semibold tabular-nums">{count(item.key)}</p>
          </button>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Select a status to filter the ledger; select it again to show all. Counts follow the source, search and dates.</p>
      </div>
      <div className="min-w-0 rounded-xl border bg-card p-4">
        {source === 'candidate' ? <>
          <h2 className="text-sm font-semibold">Local transfers · ETB final</h2>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{local.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</p>
          <p className="mt-1 text-xs text-muted-foreground">{local.count} settled candidate-to-local transfers. Final recorded amounts; no FX conversion. Pending, failed and refunded payments are excluded.</p>
          {local.otherCurrencies.length > 0 && <p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-300">Non-ETB candidate receipts excluded; review {local.otherCurrencies.join(' · ')}.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Open receipts for ChechePay confirmations and supporting evidence. Demo records remain synthetic.</p>
        </> : <>
        <h2 className="text-sm font-semibold">Foreign receipts · USD estimate</h2>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{usdFormat.format(summary.foreignUsd)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{summary.convertedCount} settled foreign transfers. Pending, failed, refunded and candidate stage fees are excluded.</p>
        {!!Object.keys(summary.excludedForeignTotals).length && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">Not converted (no reference rate): {Object.entries(summary.excludedForeignTotals).map(([currency, total]) => `${total.toLocaleString()} ${currency}`).join(' · ')}.</p>}
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium">Original totals & conversion basis</summary>
          <p className="mt-2 text-muted-foreground">All settled receipts in their original currencies: {Object.entries(summary.originalTotals).map(([currency, total]) => `${total.toLocaleString()} ${currency}`).join(' · ') || 'None'}.</p>
          <p className="mt-2 text-muted-foreground">Portal reference rates, not live FX or bank-confirmed USD. {Object.entries(summary.rates).map(([currency, rate]) => `1 ${currency} = ${rate.toFixed(6)} USD`).join(' · ')}</p>
        </details>
        </>}
      </div>
    </div>
  </section>;
}
