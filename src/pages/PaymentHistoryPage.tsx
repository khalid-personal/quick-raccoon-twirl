import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import type { Payment } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartNoAxesCombined, FileSearch, Globe2, Landmark, List, Loader2, Scale, UserRound } from 'lucide-react';
import { navigationAccent } from '@/components/ui/navigation-rail';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { checkForeignPayment, isForeignPayment } from '@/lib/currency';
import { BankReconciliation } from '@/components/BankReconciliation';
import AgencyPaymentReconciliation from '@/components/AgencyPaymentReconciliation';
import PaymentEvidenceReview, { type PaymentEvidence } from '@/components/PaymentEvidenceReview';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadBankStatement } from '@/lib/bank-statement-store';
import { reconcile } from '@/lib/bank-reconciliation';
import PaymentLedgerSummary from '@/components/PaymentLedgerSummary';
import { filterPaymentLedger, PAYMENT_STATUS_LABELS, type PaymentStatusFilter } from '@/lib/payment-ledger';
import { getCandidates, getForeignAgencies, getLocalAgencies, getStaffUsers } from '@/lib/data-store';
import { useLocation, useSearchParams } from 'react-router-dom';
import { usePageMemory } from '@/hooks/use-page-memory';
import AgencyResolutionCenter from '@/components/AgencyResolutionCenter';
import PaymentHistoryOverview from '@/components/PaymentHistoryOverview';
import { EntityProfileButton } from '@/components/CandidateQuickViewProvider';
import { currentVerifiedPaymentIds } from '@/lib/payment-review-clearance';
import { amountDiscrepancies, autoResolveVerifiedAgencyCases, getAgencyResolutionCases } from '@/lib/agency-resolution';
import MinistrySubmissionCountdown from '@/components/MinistrySubmissionCountdown';
import OutboundPaymentSummary from '@/components/OutboundPaymentSummary';
import PaymentReceipt from '@/components/PaymentReceipt';
import { isForeignAgencyRole } from '@/lib/api/auth';

type PaymentView = 'all' | 'foreign' | 'candidate';

const PaymentHistoryPage: React.FC = () => {
  const { user, viewAs, isDemo, userRole, userLocalAgencyId, userForeignAgencyId, userLocalAgencyName, userForeignAgencyName } = useAuth();
  const isForeign = isForeignAgencyRole(userRole);
  const isLocal = userRole === 'local-agency';
  const isLocalStaff = userRole === 'staff' && !!userLocalAgencyId;
  const [params] = useSearchParams();
  const location = useLocation();
  const [paymentView, setPaymentView] = usePageMemory<PaymentView>('source-view', 'all');
  const [search, setSearch] = usePageMemory('search', '');
  const [status, setStatus] = usePageMemory<PaymentStatusFilter>('status', 'all');
  const [from, setFrom] = usePageMemory('from', '');
  const [to, setTo] = usePageMemory('to', '');
  const [agency, setAgency] = usePageMemory('agency', params.get('agency') ?? '');
  const [tab, setTab] = usePageMemory('tab-v2', ['ledger', 'discrepancies', 'resolution'].includes(params.get('tab') ?? '') ? params.get('tab')! : 'overview');
  const [openReceipts, setOpenReceipts] = React.useState<Array<{ payment: Payment; activation: number }>>([]);
  const inspectReceipt = (payment: Payment) => setOpenReceipts(previous => previous.some(item => item.payment.id === payment.id)
    ? previous.map(item => item.payment.id === payment.id ? { payment, activation: item.activation + 1 } : item)
    : [...previous, { payment, activation: 0 }]);
  const canReview = isLocal || userRole === 'superadmin';
  const canInspect = canReview || isLocalStaff || userRole === 'admin';
  const effectiveStaffId = viewAs?.userId ?? user?.id;
  const staffEmail = getStaffUsers().find(person => person.id === effectiveStaffId)?.email ?? (!viewAs ? user?.email : undefined);
  const statementUploader = isLocalStaff && effectiveStaffId && staffEmail ? { id: effectiveStaffId, email: staffEmail } : undefined;
  React.useEffect(() => {
    if (['overview', 'ledger', 'discrepancies', 'resolution'].includes(params.get('tab') ?? '')) setTab(params.get('tab')!);
    if (location.hash === '#resolution') setTab('resolution');
    if (params.get('agency')) setAgency(params.get('agency')!);
    if (params.get('source') === 'candidate' && params.get('tab') === 'discrepancies') { setPaymentView('candidate'); setTab('ledger'); }
  }, [params, location.hash, setAgency, setPaymentView, setTab]);
  const { data: agencies = [] } = useQuery({ queryKey: ['paymentReviewAgencies'], queryFn: api.getLocalAgencyList, enabled: canInspect && !isLocal && !isLocalStaff });
  const { data: loadedPayments = [], isLoading, isError, refetch } = useQuery<Payment[]>({
    queryKey: ['paymentHistory', userRole, userLocalAgencyId, userForeignAgencyId],
    queryFn: () => isForeign
      ? api.getPaymentsByForeignAgency(userForeignAgencyId ?? '')
      : isLocal || isLocalStaff
        ? api.getPaymentsByLocalAgency(userLocalAgencyId ?? '')
        : api.getAllPayments(),
  });
  const payments = isForeign ? loadedPayments.filter(payment => !!userForeignAgencyId && isForeignPayment(payment)
    && payment.payer_foreign_agency_id === userForeignAgencyId) : loadedPayments;
  const reviewQueue = useQuery({
    queryKey: ['paymentReviewQueue', isDemo, user?.id, viewAs?.userId, userRole],
    enabled: userRole === 'superadmin',
    queryFn: async () => {
      const actor = { id: viewAs?.userId ?? user?.id ?? '', email: user?.email ?? '', role: userRole ?? '' };
      if (actor.id && actor.email) await autoResolveVerifiedAgencyCases(actor);
      return { verified: currentVerifiedPaymentIds(), cases: getAgencyResolutionCases().filter(record => record.state !== 'resolved'), gaps: amountDiscrepancies() };
    },
    refetchInterval: 30000,
  });
  const refreshQueue = reviewQueue.refetch;
  React.useEffect(() => {
    if (userRole !== 'superadmin') return;
    const refresh = () => void refreshQueue();
    window.addEventListener('bank-statement-changed', refresh); window.addEventListener('agency-resolution-changed', refresh); window.addEventListener('supabase-data-changed', refresh);
    return () => { window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('agency-resolution-changed', refresh); window.removeEventListener('supabase-data-changed', refresh); };
  }, [refreshQueue, userRole]);
  React.useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener('supabase-data-changed', refresh);
    return () => window.removeEventListener('supabase-data-changed', refresh);
  }, [refetch]);
  const title = isForeign ? 'Money sent' : isLocal ? `${userLocalAgencyName ?? 'Local agency'} payments` : 'Payment history';
  const foreignPayments = payments.filter(isForeignPayment);
  const candidatePayments = payments.filter(payment => !isForeignPayment(payment));
  const visiblePayments = isForeign ? foreignPayments : paymentView === 'foreign' ? foreignPayments : paymentView === 'candidate' ? candidatePayments : payments;
  const summaryPayments = filterPaymentLedger(visiblePayments.filter(payment => isForeign || isLocal || isLocalStaff || !agency || payment.payee_local_agency_id === agency), { from, to, search });
  const filtered = filterPaymentLedger(summaryPayments, { status });
  const reviewAgency = isLocal || isLocalStaff ? userLocalAgencyId ?? '' : agencies.some(item => item.id === agency) ? agency : '';
  const openList = (nextStatus: PaymentStatusFilter, source?: 'foreign' | 'candidate') => {
    setStatus(nextStatus);
    if (source && !isForeign) setPaymentView(source);
    setTab('ledger');
  };
  const effectiveTab = (!canInspect && (tab === 'discrepancies' || tab === 'resolution')) || (userRole !== 'superadmin' && tab === 'resolution') ? 'overview' : tab;

  return <div className="space-y-6">
    <PageHeader title={title} description={isForeign ? `${userForeignAgencyName ?? 'Your agency'}’s outbound transfers to local agencies. View and print your receipts.` : "See what is marked as paid and what is still waiting. Open a receipt; reviewers can compare it with the agency’s uploaded bank records."} actions={<MinistrySubmissionCountdown />} />
    <Tabs value={effectiveTab} onValueChange={setTab} className="space-y-5">
    <TabsList aria-label="Payment sections" className="w-full">
      <TabsTrigger value="overview"><ChartNoAxesCombined aria-hidden="true" />{isForeign ? 'Money sent overview' : 'Finance overview'}</TabsTrigger>
      <TabsTrigger value="ledger"><List aria-hidden="true" />{isForeign ? 'Receipts' : 'Payments list'}</TabsTrigger>
      {canInspect && <TabsTrigger value="discrepancies"><FileSearch aria-hidden="true" />Bank records & checks</TabsTrigger>}
      {userRole === 'superadmin' && <TabsTrigger value="resolution"><Scale aria-hidden="true" />Payment issues</TabsTrigger>}
    </TabsList>
    {userRole === 'superadmin' && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-rose-500/5 p-4" aria-label="Payment resolution status">
      <div><h2 className="text-lg font-semibold">Automatic payment checks → Payment issues</h2><p className="text-sm text-muted-foreground">{reviewQueue.isLoading ? 'Checking receipts and uploaded bank records…' : `${summaryPayments.filter(payment => reviewQueue.data?.verified.has(payment.id)).length} payments fully checked in this view · ${reviewQueue.data?.cases.length ?? 0} issues to review · ${reviewQueue.data?.gaps.length ?? 0} amount differences to check across the portal.`}</p><p className="mt-1 text-xs text-muted-foreground">Only payments confirmed as received and passing all required checks are cleared automatically. A bank match alone is not enough. An agency suspension stays in place until an administrator explicitly lifts it.</p></div>
      <Button variant={effectiveTab === 'resolution' ? 'default' : 'outline'} onClick={() => setTab('resolution')}><Scale className="mr-2 h-5 w-5" />View payment issues</Button>
      {reviewQueue.error && <p role="alert" className="w-full text-sm text-destructive">{reviewQueue.error.message}</p>}
    </section>}
    {(effectiveTab === 'overview' || effectiveTab === 'ledger') && <section className="space-y-4 rounded-2xl border bg-card/60 p-4" aria-label="Payment scope filters">
    {!isForeign && <div className="space-y-2">
      <p className="text-base font-semibold">Choose the payment flow</p>
      <ToggleGroup navigation type="single" value={paymentView} onValueChange={value => { if (value === 'all' || value === 'foreign' || value === 'candidate') setPaymentView(value); }} className="navigation-rail-sources w-full" aria-label="Filter payment source">
        <ToggleGroupItem value="all" aria-label={`All payments · ${payments.length}`}>
          <Landmark aria-hidden="true" />
          <span className="min-w-0"><span className="block font-semibold">All payments</span><span className="navigation-rail-detail">Both flows in one view · {payments.length.toLocaleString()} receipts</span></span>
        </ToggleGroupItem>
        <ToggleGroupItem value="foreign" aria-label={`Foreign agency payments to local agencies · ${foreignPayments.length}`} style={navigationAccent('#7dd3fc')}>
          <Globe2 aria-hidden="true" />
          <span className="min-w-0"><span className="block font-semibold">Foreign agency → local agency</span><span className="navigation-rail-detail">Agency payments · {foreignPayments.length.toLocaleString()} receipts</span></span>
        </ToggleGroupItem>
        <ToggleGroupItem value="candidate" aria-label={`Candidate payments to local agencies · ${candidatePayments.length}`} style={navigationAccent('#6ee7b7')}>
          <UserRound aria-hidden="true" />
          <span className="min-w-0"><span className="block font-semibold">Candidate → local agency</span><span className="navigation-rail-detail">Candidate stage fees · {candidatePayments.length.toLocaleString()} receipts</span></span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>}
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label htmlFor="payment-search">Find a payment</Label><Input id="payment-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Receipt, payer, reference or currency" /></div>
      {canInspect && !isLocal && !isLocalStaff ? <Select value={agency || 'all'} onValueChange={value => setAgency(value === 'all' ? '' : value)}><SelectTrigger aria-label="Payment recipient agency"><SelectValue placeholder="All recipient agencies" /></SelectTrigger><SelectContent><SelectItem value="all">All recipient agencies</SelectItem>{agencies.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select> : <p className="text-sm text-muted-foreground">Your agency's payment scope.</p>}
      <div><Label htmlFor="payment-from">From date</Label><Input id="payment-from" type="date" value={from} onChange={event => setFrom(event.target.value)} /></div>
      <div><Label htmlFor="payment-to">To date</Label><Input id="payment-to" type="date" value={to} onChange={event => setTo(event.target.value)} /></div>
    </div>
    {effectiveTab === 'ledger' && <Select value={status} onValueChange={value => setStatus(value as PaymentStatusFilter)}><SelectTrigger aria-label="Transaction status" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>}
    {from && to && from > to && <p role="alert" className="text-sm text-destructive">Choose a “From” date on or before the “To” date.</p>}
    {(status !== 'all' || search || from || to || agency) && <Button variant="ghost" size="sm" onClick={() => { setStatus('all'); setSearch(''); setFrom(''); setTo(''); setAgency(''); }}>Clear payment filters</Button>}
    <p className="text-xs text-muted-foreground">{isForeign ? 'Only your agency’s outbound receipts are shown. Search and dates apply to the overview and list.' : 'Source, search, recipient and dates apply to the overview and list. Status narrows the list only.'}</p>
    </section>}
    {isLoading && <p role="status" className="flex items-center gap-2 p-6"><Loader2 className="h-5 w-5 animate-spin" />Loading payment history…</p>}
    {isError && <div role="alert" className="rounded-xl border border-destructive p-4"><p>Could not load payment history.</p><Button variant="outline" onClick={() => void refetch()}>Retry payments</Button></div>}
    <TabsContent value="overview" className="space-y-5">{!isLoading && !isError && (isForeign ? <OutboundPaymentSummary payments={summaryPayments} onList={openList} /> : <PaymentHistoryOverview payments={summaryPayments} source={paymentView} agencies={getLocalAgencies()} onList={openList} onReceipt={inspectReceipt} onEvidence={canInspect ? () => setTab('discrepancies') : undefined} onResolution={userRole === 'superadmin' ? () => setTab('resolution') : undefined} />)}</TabsContent>
    <TabsContent value="ledger" className="space-y-5">
    {isForeign ? <OutboundPaymentSummary payments={summaryPayments} onList={openList} /> : <PaymentLedgerSummary payments={summaryPayments} source={paymentView} status={status} onStatusChange={setStatus} />}
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">{isForeign ? 'Outbound receipts' : 'Payments list'}</h2><p className="text-sm text-muted-foreground">{filtered.length} of {summaryPayments.length} receipts in scope · newest first</p></div><p className="text-xs text-muted-foreground">{isForeign ? 'Open a receipt for transaction details and printing.' : 'Click Investigate / View receipt for proof and history.'}</p></div>
    <Card><CardContent className="overflow-x-auto p-0">
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : isError ? <p role="alert" className="p-8 text-center text-destructive">Could not load payment history.</p>
          : filtered.length === 0 ? <p className="p-8 text-center text-muted-foreground">No payments match these filters.</p>
            : <Table><TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Payment from</TableHead><TableHead>Payer → recipient</TableHead><TableHead>Amount</TableHead><TableHead>Candidates covered</TableHead><TableHead>Status</TableHead><TableHead>Payment reference</TableHead><TableHead>Receipt</TableHead>
            </TableRow></TableHeader><TableBody>{[...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(payment => (
              <TableRow key={payment.id}>
                <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                <TableCell><Badge variant="outline">{isForeignPayment(payment) ? 'Foreign agency → local' : 'Candidate → local'}</Badge></TableCell>
                <TableCell>{isForeign ? <>
                  <p className="text-sm font-medium">{payment.payer_display_name || userForeignAgencyName || 'Your agency'}</p>
                  <p className="text-xs text-muted-foreground">→ {getLocalAgencies().find(agency => agency.id === payment.payee_local_agency_id)?.name || 'Recipient not recorded'}</p>
                </> : <><p className="text-sm font-medium"><EntityProfileButton kind="foreign-agency" entityId={isForeignPayment(payment) ? payment.payer_foreign_agency_id : undefined}>{payment.payer_display_name || (isForeignPayment(payment) ? getForeignAgencies().find(agency => agency.id === payment.payer_foreign_agency_id)?.name || 'Foreign agency not recorded' : 'Candidate')}</EntityProfileButton></p><p className="text-xs text-muted-foreground">→ <EntityProfileButton kind="local-agency" entityId={payment.payee_local_agency_id}>{getLocalAgencies().find(agency => agency.id === payment.payee_local_agency_id)?.name || 'Recipient not recorded'}</EntityProfileButton></p></>}</TableCell>
                <TableCell className="tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</TableCell>
                <TableCell>{payment.candidate_ids.length}</TableCell>
                <TableCell><Badge variant="outline" className={payment.status === 'succeeded' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : payment.status === 'pending' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : payment.status === 'failed' ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{payment.receipt_number || payment.provider_reference || payment.id}</TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => inspectReceipt(payment)}>{userRole === 'superadmin' ? 'Check payment' : 'View receipt'}</Button></TableCell>
              </TableRow>
            ))}</TableBody></Table>}
    </CardContent></Card>
    </TabsContent>
    {canInspect && <TabsContent value="discrepancies" className="space-y-4">
      <div><h2 className="text-xl font-semibold">Foreign agency → local agency discrepancies</h2><p className="mt-1 text-sm text-muted-foreground">Candidate ChechePay payments are shown in the receipt list as pending, payment failed or payment timed out. They do not create local agency discrepancy cases.</p></div>
      {!isLocal && !isLocalStaff && <Select value={agency || 'all'} onValueChange={value => setAgency(value === 'all' ? '' : value)}><SelectTrigger aria-label="Recipient agency for statement review" className="w-full sm:w-96"><SelectValue placeholder="Select a recipient local agency" /></SelectTrigger><SelectContent><SelectItem value="all">All local agencies</SelectItem>{agencies.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>}
      {userRole === 'superadmin' && <AgencyPaymentReconciliation localAgencyId={reviewAgency || undefined} />}
      {reviewAgency ? <>
        {userRole !== 'superadmin' && <AgencyPaymentReconciliation localAgencyId={reviewAgency} />}
        <BankReconciliation key={reviewAgency} agencyId={reviewAgency} paymentSource="foreign" allowActions={canReview} statementUploader={statementUploader} payments={foreignPayments.filter(payment => payment.status === 'succeeded' && payment.payee_local_agency_id === reviewAgency)} />
      </> : <section aria-label="Foreign transfer bank differences" className="space-y-5">
        <div><h2 className="text-xl font-semibold">Foreign transfers compared with bank records</h2><p className="text-sm text-muted-foreground">Check short payments, extra amounts and missing bank entries by receiving local agency. Contract checks above are separate from these bank differences.</p></div>
        {agencies.filter(item => foreignPayments.some(payment => payment.status === 'succeeded' && payment.payee_local_agency_id === item.id)).map(item =>
          <section key={item.id} aria-label={`${item.name} foreign transfer checks`} className="space-y-3 rounded-2xl border p-4">
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <BankReconciliation agencyId={item.id} paymentSource="foreign" allowActions={canReview} payments={foreignPayments.filter(payment => payment.status === 'succeeded' && payment.payee_local_agency_id === item.id)} />
          </section>)}
        {!foreignPayments.some(payment => payment.status === 'succeeded') && <p className="text-sm text-muted-foreground">No settled foreign transfers to compare in this view.</p>}
      </section>}
    </TabsContent>}
    {userRole === 'superadmin' && <TabsContent value="resolution"><div id="resolution"><AgencyResolutionCenter /></div></TabsContent>}
    </Tabs>
    {openReceipts.filter(item => payments.some(payment => payment.id === item.payment.id)).map(item => isForeign || !isForeignPayment(item.payment)
      ? <PaymentReceipt key={item.payment.id} payment={payments.find(payment => payment.id === item.payment.id)!} outbound={isForeign} open onOpenChange={open => { if (!open) setOpenReceipts(previous => previous.filter(other => other.payment.id !== item.payment.id)); }} />
      : <PaymentReviewWindow key={item.payment.id} payment={payments.find(payment => payment.id === item.payment.id)!} payments={payments} activation={item.activation} canReview={canReview} onClose={() => setOpenReceipts(previous => previous.filter(other => other.payment.id !== item.payment.id))} />)}
  </div>;
};

function PaymentReviewWindow({ payment, payments, activation, canReview, onClose }: { payment: Payment; payments: Payment[]; activation: number; canReview: boolean; onClose: () => void }) {
  const statement = loadBankStatement(payment.payee_local_agency_id, isForeignPayment(payment) ? 'foreign' : 'candidate');
  const match = statement ? reconcile(payments.filter(other => other.status === 'succeeded' && isForeignPayment(other) === isForeignPayment(payment) && other.payee_local_agency_id === payment.payee_local_agency_id), statement.lines).matches.find(match => match.payment.id === payment.id) : undefined;
  const issue = isForeignPayment(payment) ? checkForeignPayment(payment, getCandidates()) : null;
  const evidence: PaymentEvidence = { caseId: payment.id, payment, match, issue: issue?.issue, explanation: issue ? `${issue.message} This is a contract-payment rule flag, not a confirmed bank discrepancy.` : undefined };
  return <PaymentEvidenceReview activation={activation} agencyId={payment.payee_local_agency_id} evidence={evidence} statementName={statement?.name ?? 'No bank comparison'} allowActions={canReview && !!payment.payee_local_agency_id} onClose={onClose} />;
}

export default PaymentHistoryPage;
