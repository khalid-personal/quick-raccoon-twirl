import type { Payment } from '@/lib/types';
import { PAYMENT_STATUS_LABELS, type PaymentStatusFilter } from '@/lib/payment-ledger';
import { Button } from './ui/button';

export default function OutboundPaymentSummary({ payments, onList }: {
  payments: Payment[]; onList: (status: PaymentStatusFilter) => void;
}) {
  const settled = payments.filter(payment => payment.status === 'succeeded');
  const totals = settled.reduce<Record<string, number>>((result, payment) => {
    const currency = payment.currency.trim().toUpperCase();
    result[currency] = (result[currency] ?? 0) + payment.amount;
    return result;
  }, {});
  return <section className="space-y-4" aria-label="Money sent overview">
    <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
      <h2 className="text-xl font-bold">Money sent</h2>
      <p className="mt-2 text-sm text-muted-foreground">Settled outbound transfers to local agencies · original currencies</p>
      <p className="mt-3 text-3xl font-bold tabular-nums">{Object.entries(totals).map(([currency, amount]) => `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`).join(' · ') || 'No settled transfers'}</p>
      <p className="mt-2 text-sm text-muted-foreground">{settled.length} settled receipts. No currency conversion. Waiting, failed and refunded transfers are not included.</p>
      <Button variant="outline" className="mt-4" onClick={() => onList('succeeded')}>View settled receipts</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => onList('all')}>All receipts · {payments.length}</Button>
      {Object.entries(PAYMENT_STATUS_LABELS).map(([status, label]) => <Button key={status} variant="outline" onClick={() => onList(status as PaymentStatusFilter)}>
        {label} · {payments.filter(payment => payment.status === status).length}
      </Button>)}
    </div>
  </section>;
}
