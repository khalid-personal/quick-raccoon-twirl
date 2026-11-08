import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import { analyzeAgencyPayments, DISCREPANCIES, ISSUE_LABEL, isDiscrepancy, type ReconIssue, type ReconRow } from '@/lib/agency-payments';
import { usePortalData } from '@/hooks/use-portal-data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CandidateQuickView from './CandidateQuickView';
import WidgetShell from './WidgetShell';
import PaymentEvidenceReview, { type PaymentEvidence } from './PaymentEvidenceReview';
import { loadBankStatement } from '@/lib/bank-statement-store';
import { reconcile } from '@/lib/bank-reconciliation';
import { useAuth } from '@/lib/auth-context';
import { isForeignPayment } from '@/lib/currency';
import CandidateAvatar from '@/components/CandidateAvatar';

const ISSUE_TONE: Record<ReconIssue, string> = {
  paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', awaiting: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  missing: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  failed: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', short: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  over: 'bg-sky-500/10 text-sky-700 dark:text-sky-300', 'wrong-currency': 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  etb: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', 'wrong-payee': 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  'wrong-payer': 'bg-orange-500/10 text-orange-700 dark:text-orange-300', 'duplicate-reference': 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const AgencyPaymentReconciliation: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const { candidates, payments, stages, locals, foreigns } = usePortalData();
  const [filter, setFilter] = useState<ReconIssue | 'all'>('all');
  const [showAll, setShowAll] = useState(false);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [review, setReview] = useState<{ agencyId: string; statementName: string; evidence: PaymentEvidence } | null>(null);
  const { userRole } = useAuth();
  const canEscalate = userRole === 'superadmin' || userRole === 'local-agency';

  const summary = useMemo(() => analyzeAgencyPayments(candidates, payments, stages, Date.now(), localAgencyId), [candidates, payments, stages, localAgencyId]);
  const name = (list: Array<{ id: string; name: string }>, id: string) => list.find(item => item.id === id)?.name ?? 'Unknown';
  const openReview = (row: ReconRow) => {
    const statement = loadBankStatement(row.localAgencyId);
    const match = statement && row.payment
      ? reconcile(payments.filter(payment => isForeignPayment(payment) && payment.status === 'succeeded' && payment.payee_local_agency_id === row.localAgencyId), statement.lines).matches.find(item => item.payment.id === row.payment?.id)
      : undefined;
    setReview({ agencyId: row.localAgencyId, statementName: statement?.name ?? 'No statement for expected recipient', evidence: {
      caseId: `contract:${row.candidate.id}`, payment: row.payment, match,
      issue: ISSUE_LABEL[row.issue], explanation: `${row.candidate.first_name} ${row.candidate.last_name} (${row.candidate.tracking_code}): ${row.message} This is a contract-payment rule flag, not a confirmed bank discrepancy.`,
      expected: { amount: row.expectedMin, currency: row.currency, payer: name(foreigns, row.foreignAgencyId), payee: name(locals, row.localAgencyId) },
    } });
  };
  const flagged = summary.rows.filter(row => isDiscrepancy(row.issue) && (filter === 'all' || row.issue === filter));
  const visible = showAll ? flagged : flagged.slice(0, 8);
  const matchedRate = summary.contracts ? Math.round((summary.byIssue.paid / summary.contracts) * 100) : 0;
  const settled = summary.expectedUsd ? Math.min(100, Math.round((summary.receivedUsd / summary.expectedUsd) * 100)) : 0;

  return (
    <WidgetShell title="Foreign agency payments to local agencies" description="We compare each work contract with the payment the foreign agency is expected to make to the local agency." icon={Scale} accent="emerald" className="h-full" bodyClassName="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Contracts checked', String(summary.contracts), 'text-foreground'],
          ['Paid as expected', `${summary.byIssue.paid} (${matchedRate}%)`, 'text-emerald-600'],
          ['Payments needing review', String(summary.flagged), summary.flagged ? 'text-rose-600' : 'text-emerald-600'],
          ['Received vs contract amount', `${usd(summary.receivedUsd)} / ${usd(summary.expectedUsd)}`, 'text-foreground'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border bg-background/60 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', tone)}>{value}</p>
          </div>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${settled}% of expected funds received`}>
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${settled}%` }} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Payments between agencies</p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr><th className="px-3 py-2 text-left">Foreign agency</th><th className="px-3 py-2 text-left">Pays local agency</th><th className="px-3 py-2 text-right">Work contracts</th><th className="px-3 py-2 text-right">Paid as expected</th><th className="px-3 py-2 text-right">Needs review</th><th className="px-3 py-2 text-right">Received / contract amount</th></tr></thead>
            <tbody>
              {summary.pairs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No work contracts to check yet.</td></tr>}
              {summary.pairs.map(pair => (
                <tr key={pair.key}>
                  <td className="px-3 py-2 font-medium">{name(foreigns, pair.foreignAgencyId)}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />{name(locals, pair.localAgencyId)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{pair.contracts}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{pair.matched}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pair.flagged ? <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-600">{pair.flagged}</span> : <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{usd(pair.receivedUsd)} / {usd(pair.expectedUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm font-semibold">Payments needing review</p>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-xs" onClick={() => setFilter('all')}>All {summary.flagged}</Button>
          {DISCREPANCIES.filter(issue => summary.byIssue[issue] > 0).map(issue => (
            <Button key={issue} size="sm" variant={filter === issue ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-xs" onClick={() => setFilter(issue)}>{ISSUE_LABEL[issue]} {summary.byIssue[issue]}</Button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr><th className="px-3 py-2 text-left">Candidate</th><th className="px-3 py-2 text-left">Payment from → to</th><th className="px-3 py-2 text-left">What needs checking</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-left">Details</th><th className="px-3 py-2 text-left">Next step</th></tr></thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No payment issues for this selection.</td></tr>}
              {visible.map(row => (
                <tr key={row.candidate.id}>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><CandidateAvatar candidate={row.candidate} className="h-9 w-9" /><div><button type="button" className="font-medium hover:text-primary hover:underline" onClick={() => setQuickId(row.candidate.id)}>{row.candidate.first_name} {row.candidate.last_name}</button><p className="font-mono text-xs text-muted-foreground">{row.candidate.tracking_code}</p></div></div></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{name(foreigns, row.foreignAgencyId)}<br />{name(locals, row.localAgencyId)}</td>
                  <td className="px-3 py-2"><Badge variant="secondary" className={cn('whitespace-nowrap', ISSUE_TONE[row.issue])}>{ISSUE_LABEL[row.issue]}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.received ? `${Math.round(row.received).toLocaleString()} ${row.payment?.currency ?? row.currency}` : '\u2014'}<p className="text-xs text-muted-foreground">Minimum due: {row.expectedMin?.toLocaleString()} {row.currency}</p></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.message}</td>
                  <td className="px-3 py-2"><Button size="sm" variant="outline" aria-label={`Review contract payment ${row.candidate.tracking_code}`} onClick={() => openReview(row)}>Check payment</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {flagged.length > 8 && <Button variant="ghost" size="sm" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer' : `Show all ${flagged.length}`}</Button>}
      </div>
      <CandidateQuickView candidateId={quickId} onOpenChange={open => !open && setQuickId(null)} />
      <PaymentEvidenceReview agencyId={review?.agencyId ?? ''} evidence={review?.evidence ?? null} statementName={review?.statementName ?? ''} allowActions={canEscalate} onClose={() => setReview(null)} />
    </WidgetShell>
  );
};

export default AgencyPaymentReconciliation;
