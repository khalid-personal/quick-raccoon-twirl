import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Payment } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import PageHeader from '@/components/page/PageHeader';
import PaymentLedgerSummary from '@/components/PaymentLedgerSummary';
import { filterPaymentLedger, type PaymentStatusFilter } from '@/lib/payment-ledger';
import { BankReconciliation } from '@/components/BankReconciliation';
import { checkForeignPayment, isForeignPayment, MIN_PAYMENT_USD } from '@/lib/currency';
import { getCandidates } from '@/lib/data-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TriangleAlert } from 'lucide-react';
import type { ReconciliationSummary } from '@/lib/bank-reconciliation';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PaymentEvidenceReview from '@/components/PaymentEvidenceReview';
import { loadBankStatement } from '@/lib/bank-statement-store';
import { reconcile } from '@/lib/bank-reconciliation';
import AgencyPaymentReconciliation from '@/components/AgencyPaymentReconciliation';
import { useSearchParams } from 'react-router-dom';
import LocalPaymentEvidence from '@/components/LocalPaymentEvidence';

const LocalAgencyPayments: React.FC = () => {
  const { userLocalAgencyId } = useAuth();
  const [params] = useSearchParams();
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentSource, setPaymentSource] = useState<'foreign' | 'candidate'>(params.get('source') === 'candidate' ? 'candidate' : 'foreign');
  React.useEffect(() => {
    if (params.get('source')) setPaymentSource(params.get('source') === 'candidate' ? 'candidate' : 'foreign');
  }, [params]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Payment | null>(null);
  const { data: allPayments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['localAgencyPayments', userLocalAgencyId],
    queryFn: () => api.getPaymentsByLocalAgency(userLocalAgencyId ?? ''),
    enabled: Boolean(userLocalAgencyId),
  });

  const candidates = getCandidates();
  const issueOf = (p: Payment) => isForeignPayment(p) ? checkForeignPayment(p, candidates)?.message : undefined;
  const foreignPayments = allPayments.filter(isForeignPayment);
  const candidatePayments = allPayments.filter(payment => !isForeignPayment(payment));
  const payments = paymentSource === 'foreign' ? foreignPayments : candidatePayments;
  const received = payments.filter(p => p.status === 'succeeded');
  const filteredPayments = payments.filter(payment => {
    if (!filterPaymentLedger([payment], { search }).length) return false;
    const status = reconciliation?.byPaymentId[payment.id];
    if (paymentFilter === 'initiated') return payment.status === 'pending';
    if (paymentFilter === 'settled') return payment.status === 'succeeded';
    if (paymentFilter === 'failed' || paymentFilter === 'refunded') return payment.status === paymentFilter;
    if (paymentFilter === 'matched') return status === 'matched';
    if (paymentFilter === 'amount-difference') return status === 'short' || status === 'over';
    if (paymentFilter === 'evidence-mismatch') return status === 'reference-mismatch' || status === 'currency-mismatch';
    if (paymentFilter === 'missing-deposit') return status === 'missing';
    return true;
  });
  const summaryStatus: PaymentStatusFilter = paymentFilter === 'settled' ? 'succeeded' : paymentFilter === 'initiated' ? 'pending' : paymentFilter === 'failed' || paymentFilter === 'refunded' ? paymentFilter : 'all';
  const statement = loadBankStatement(userLocalAgencyId ?? '', selected ? isForeignPayment(selected) ? 'foreign' : 'candidate' : paymentSource);
  const selectedMatch = selected && statement
    ? reconcile(allPayments.filter(payment => payment.status === 'succeeded' && isForeignPayment(payment) === isForeignPayment(selected)), statement.lines).matches.find(match => match.payment.id === selected.id)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Payment History" description={paymentSource === 'foreign'
        ? `Foreign-agency transfers arrive in the work-contract currency, not ETB. The regulated baseline is ${MIN_PAYMENT_USD} USD per candidate.`
        : 'Candidate payments are local stage fees paid to this agency. They are tracked separately from foreign-agency transfers.'} />
      <ToggleGroup type="single" value={paymentSource} onValueChange={value => { if (value) { setPaymentSource(value as typeof paymentSource); setPaymentFilter('all'); setReconciliation(null); } }} variant="outline" className="flex flex-wrap justify-start" aria-label="Payment source">
        <ToggleGroupItem value="foreign" size="sm">Foreign agency → local · {foreignPayments.length}</ToggleGroupItem>
        <ToggleGroupItem value="candidate" size="sm">Candidate → local · {candidatePayments.length}</ToggleGroupItem>
      </ToggleGroup>
      <PaymentLedgerSummary payments={filterPaymentLedger(payments, { search })} status={summaryStatus} onStatusChange={value => setPaymentFilter(value === 'succeeded' ? 'settled' : value === 'pending' ? 'initiated' : value)} />
      {paymentSource === 'foreign' && userLocalAgencyId && <>
        <AgencyPaymentReconciliation localAgencyId={userLocalAgencyId} />
      </>}
      {paymentSource === 'candidate' && userLocalAgencyId && <LocalPaymentEvidence key={userLocalAgencyId} localAgencyId={userLocalAgencyId} />}
      {userLocalAgencyId && <BankReconciliation key={`${userLocalAgencyId}:${paymentSource}`} agencyId={userLocalAgencyId} paymentSource={paymentSource} payments={received} onSummaryChange={setReconciliation} />}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Input aria-label="Search payment receipts" className="w-full sm:w-80" placeholder="Receipt, reference, payer or amount" value={search} onChange={event => setSearch(event.target.value)} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {reconciliation && (reconciliation.short + reconciliation.over + reconciliation.missing + reconciliation.unrecognizedDeposits + reconciliation['currency-mismatch'] + reconciliation['reference-mismatch'] > 0)
                ? <><TriangleAlert className="h-4 w-4 text-amber-600" />{reconciliation.short + reconciliation.over + reconciliation.missing + reconciliation.unrecognizedDeposits + reconciliation['currency-mismatch'] + reconciliation['reference-mismatch']} reconciliation discrepancies</>
                : reconciliation ? 'Settled payments match the uploaded statement.' : 'Upload a bank statement to authenticate settled deposits.'}
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger aria-label="Filter payments by settlement" className="w-56"><SelectValue placeholder="All payments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="initiated">Initiated · pending settlement</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <>
                  <SelectItem value="matched"><span className="text-emerald-700">▲</span> Matched</SelectItem>
                  <SelectItem value="amount-difference"><span className="text-amber-600">▲</span> Short / over</SelectItem>
                  <SelectItem value="evidence-mismatch">Reference / currency mismatch</SelectItem>
                  <SelectItem value="missing-deposit"><span className="text-red-600">▲</span> Missing deposit</SelectItem>
                </>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredPayments.length === 0 ? (
            <p className="text-muted-foreground">No payments found for this local agency.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment source</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => {
                    const payerCandidate = payment.payer_candidate_id ? candidates.find(candidate => candidate.id === payment.payer_candidate_id) : undefined;
                    return <TableRow key={payment.id}>
                      <TableCell><Badge variant="outline">{isForeignPayment(payment) ? 'Foreign agency → local' : 'Candidate → local'}</Badge></TableCell>
                      <TableCell>{payment.payer_display_name || (payerCandidate ? `${payerCandidate.first_name} ${payerCandidate.last_name}` : null) || payment.payer_foreign_agency_id || 'Candidate'}</TableCell>
                      <TableCell>{payment.amount.toLocaleString()} {payment.currency}
                        {issueOf(payment) && <Badge variant="destructive" className="ml-2" title={issueOf(payment)}>Non-compliant</Badge>}
                      </TableCell>
                      <TableCell><Badge variant={payment.status === 'succeeded' ? 'default' : 'secondary'}>{payment.status}</Badge></TableCell>
                      <TableCell>{payment.candidate_ids.join(', ')}</TableCell>
                      <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                      <TableCell><Button variant="outline" size="sm" onClick={() => setSelected(payment)}>View receipt</Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <PaymentEvidenceReview agencyId={userLocalAgencyId ?? ''} evidence={selected ? { caseId: selected.id, payment: selected, match: selectedMatch } : null} statementName={statement?.name ?? 'No statement comparison'} allowActions={false} onClose={() => setSelected(null)} />
    </div>
  );
};

export default LocalAgencyPayments;
