import React, { useMemo } from 'react';
import { BadgeDollarSign, CalendarDays, CheckCircle2, CircleDashed, Clock3, FileText, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import { Progress } from '@/components/ui/progress';
import { ALL_STAGES, type CandidateDetail } from '@/lib/types';
import { usePortalData } from '@/hooks/use-portal-data';
import { cn } from '@/lib/utils';
import { stageFeeCovered } from '@/lib/stage-readiness';
import { contractWasSent, foreignContractPayment } from '@/lib/foreign-contract-payment';
import { useAuth } from '@/lib/auth-context';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { PAYMENT_STATUS_LABELS } from '@/lib/payment-ledger';

interface CandidatePaymentsProps {
  candidateDetail: CandidateDetail;
}

const formatEtb = (amount: number) => `ETB ${Math.round(amount).toLocaleString()}`;

const CandidatePayments: React.FC<CandidatePaymentsProps> = ({ candidateDetail }) => {
  const { payments, paymentStatuses, stageFees } = usePortalData();
  const { userRole } = useAuth();
  const contractPayment = foreignContractPayment(candidateDetail, payments);
  const stageRows = useMemo(() => ALL_STAGES.map(stage => {
    const paid = stageFeeCovered(candidateDetail, stage.id, stageFees, paymentStatuses, payments);
    return {
      stage,
      fee: stageFees[stage.id] ?? stage.fee_amount ?? 0,
      paid,
    };
  }), [candidateDetail, paymentStatuses, stageFees, payments]);
  const totalDue = stageRows.reduce((total, stage) => total + stage.fee, 0);
  const totalPaid = stageRows.filter(stage => stage.paid).reduce((total, stage) => total + stage.fee, 0);
  const unpaid = Math.max(0, totalDue - totalPaid);
  const progress = totalDue ? Math.round(totalPaid / totalDue * 100) : 0;
  const transactions = payments
    .filter(payment => payment.candidate_ids.includes(candidateDetail.id) || payment.payer_candidate_id === candidateDetail.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const settledTransactions = transactions.filter(payment => payment.status === 'succeeded');
  const amountsByCurrency = settledTransactions.reduce<Record<string, number>>((totals, payment) => {
    totals[payment.currency] = (totals[payment.currency] ?? 0) + payment.amount;
    return totals;
  }, {});
  const isPaid = totalPaid >= totalDue;

  return (
    <div className="space-y-5">
      {contractWasSent(candidateDetail) && <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><h2 className="font-semibold">Contract sent → foreign agency payment</h2><p className="mt-2 text-sm">{contractPayment.detail}</p>
        {!contractPayment.paid && ['agency', 'foreign-agency'].includes(userRole ?? '') && <Button asChild className="mt-3"><Link to={`/agency?payCandidate=${encodeURIComponent(candidateDetail.id)}`}>Make payment for this candidate</Link></Button>}
        <p className="mt-2 text-xs text-muted-foreground">The linked foreign agency is responsible for this transfer. Candidate stage fees below are separate.</p></section>}
      <Card className="overflow-hidden rounded-3xl border-cyan-500/25 shadow-sm">
        <CandidateCheckpoint eyebrow="Fees and payments" title="Candidate payment overview" description="See the fees for each application stage. The payment history below also includes agency payments covering this candidate." icon={Wallet} metric={`${stageRows.filter(stage => stage.paid).length} / ${stageRows.length}`} metricLabel="Stages with fees paid" actions={
            <Badge variant={isPaid ? 'default' : candidateDetail.payment_status === 'payment_failed' ? 'destructive' : 'outline'} className="capitalize">
              {isPaid ? 'Paid' : 'Awaiting receipt'}
            </Badge>
        } />
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage fees paid</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatEtb(totalPaid)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Stage fees covered by successful recorded receipts</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage fees remaining</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatEtb(unpaid)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Total fees minus receipt-covered stage fees</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stages with fees paid</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{stageRows.filter(stage => stage.paid).length} / {stageRows.length} stages</p>
              <Progress value={progress} className="mt-3 h-2" aria-label={`${progress}% of stage fees paid`} />
              <p className="mt-1 text-xs text-muted-foreground">{progress}% of configured stage fees paid</p>
            </div>
          </div>

          <section aria-labelledby="stage-fee-breakdown">
            <div className="mb-3 flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-primary" /><h3 id="stage-fee-breakdown" className="text-sm font-semibold">Stage fee breakdown</h3></div>
            <div className="grid gap-2 md:grid-cols-2">
              {stageRows.map(({ stage, fee, paid }) => (
                <div key={stage.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', paid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    {paid ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{stage.title}</p><p className="text-xs text-muted-foreground">{fee > 0 ? formatEtb(fee) : 'No fee configured'}</p></div>
                  <Badge variant={paid ? 'default' : 'outline'}>{paid ? 'Paid' : 'Unpaid'}</Badge>
                </div>
              ))}
            </div>
            {totalDue === 0 && <p className="mt-3 text-xs text-muted-foreground">No stage fees are configured. Configure them in finance settings to show the fee amounts and remaining balance.</p>}
          </section>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-cyan-500/25">
        <CandidateCheckpoint eyebrow="Payment records" title="Payment history" description="Every payment linked to this candidate. Each currency is added separately, without conversion." icon={FileText} metric={transactions.length} metricLabel="Linked transactions" />
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}</Badge>
            {Object.entries(amountsByCurrency).map(([currency, amount]) => <Badge key={currency} variant="secondary">{Math.round(amount).toLocaleString()} {currency} settled</Badge>)}
          </div>
          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No linked transactions</p>
              <p className="mt-1 text-xs text-muted-foreground">Payment records appear here when the candidate is included in a payment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(payment => (
                <div key={payment.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', payment.status === 'succeeded' ? 'bg-emerald-500/10 text-emerald-600' : payment.status === 'failed' || payment.status === 'timed-out' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600')}>
                    {payment.status === 'succeeded' ? <CheckCircle2 className="h-4 w-4" /> : payment.status === 'pending' ? <Clock3 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{payment.receipt_number || payment.provider_reference || 'Payment record'}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" />{new Date(payment.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</p>
                  <Badge variant={payment.status === 'succeeded' ? 'default' : payment.status === 'failed' || payment.status === 'timed-out' ? 'destructive' : 'outline'}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">No successful covering receipt means unpaid. A paid checkbox alone is not proof that money was received.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidatePayments;
