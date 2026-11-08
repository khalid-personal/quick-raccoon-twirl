import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import type { Payment } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Building2, ChartNoAxesCombined, FileSearch, Globe2, Landmark, List, Loader2, Scale, UserRound } from 'lucide-react';
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
import { getCandidates, getForeignAgencies, getLocalAgencies } from '@/lib/data-store';
import { useLocation, useSearchParams } from 'react-router-dom';
import LocalPaymentEvidence from '@/components/LocalPaymentEvidence';
import { usePageMemory } from '@/hooks/use-page-memory';
import AgencyResolutionCenter from '@/components/AgencyResolutionCenter';
import PaymentHistoryOverview from '@/components/PaymentHistoryOverview';
import { EntityProfileButton } from '@/components/CandidateQuickViewProvider';
import { currentVerifiedPaymentIds } from '@/lib/payment-review-clearance';
import { amountDiscrepancies, autoResolveVerifiedAgencyCases, getAgencyResolutionCases } from '@/lib/agency-resolution';
import MinistrySubmissionCountdown from '@/components/MinistrySubmissionCountdown';

type PaymentView = 'all' | 'foreign' | 'candidate';
const sourceTileClass = 'control-nav-shine relative isolate flex h-auto min-h-28 w-full justify-start gap-4 overflow-hidden rounded-2xl border-2 p-5 text-left shadow-sm transition-all motion-safe:hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none';

const PaymentHistoryPage: React.FC = () => {
  const { user, viewAs, isDemo, userRole, userLocalAgencyId, userForeignAgencyId, userLocalAgencyName, userForeignAgencyName } = useAuth();
  const isForeign = userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'agency';
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
  const [statementSource, setStatementSource] = usePageMemory<'foreign' | 'candidate'>('statement-source', params.get('source') === 'candidate' ? 'candidate' : 'foreign');
  const [tab, setTab] = usePageMemory('tab-v2', ['ledger', 'discrepancies', 'resolution'].includes(params.get('tab') ?? '') ? params.get('tab')! : 'overview');
  const [openReceipts, setOpenReceipts] = React.useState<Array<{ payment: Payment; activation: number }>>([]);
  const inspectReceipt = (payment: Payment) => setOpenReceipts(previous => previous.some(item => item.payment.id === payment.id)
    ? previous.map(item => item.payment.id === payment.id ? { payment, activation: item.activation + 1 } : item)
    : [...previous, { payment, activation: 0 }]);
  const canReview = isLocal || userRole === 'superadmin';
  const canInspect = canReview || isLocalStaff;
  React.useEffect(() => {
    if (['overview', 'ledger', 'discrepancies', 'resolution'].includes(params.get('tab') ?? '')) setTab(params.get('tab')!);
    if (location.hash === '#resolution') setTab('resolution');
    if (params.get('agency')) setAgency(params.get('agency')!);
    if (params.get('source')) setStatementSource(params.get('source') === 'candidate' ? 'candidate' : 'foreign');
  }, [params, location.hash, setAgency, setStatementSource, setTab]);
  const { data: agencies = [] } = useQuery({ queryKey: ['paymentReviewAgencies'], queryFn: api.getLocalAgencyList, enabled: canInspect && !isLocal && !isLocalStaff });
  const { data: payments = [], isLoading, isError, refetch } = useQuery<Payment[]>({
    queryKey: ['paymentHistory', userRole, userLocalAgencyId, userForeignAgencyId],
    queryFn: () => isForeign
      ? api.getPaymentsByForeignAgency(userForeignAgencyId ?? '')
      : isLocal || isLocalStaff
        ? api.getPaymentsByLocalAgency(userLocalAgencyId ?? '')
        : api.getAllPayments(),
  });
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
  const title = isForeign ? `${userForeignAgencyName ?? 'Agency'} payments` : isLocal ? `${userLocalAgencyName ?? 'Local agency'} payments` : 'Payment history';
  const foreignPayments = payments.filter(isForeignPayment);
  const candidatePayments = payments.filter(payment => !isForeignPayment(payment));
  const visiblePayments = isForeign ? foreignPayments : paymentView === 'foreign' ? foreignPayments : paymentView === 'candidate' ? candidatePayments : payments;
  const summaryPayments = filterPaymentLedger(visiblePayments.filter(payment => isLocal || isLocalStaff || !agency || payment.payee_local_agency_id === agency), { from, to, search });
  const filtered = filterPaymentLedger(summaryPayments, { status });
  const reviewAgency = isLocal || isLocalStaff ? userLocalAgencyId ?? '' : agencies.some(item => item.id === agency) ? agency : '';
  const openList = (nextStatus: PaymentStatusFilter, source?: 'foreign' | 'candidate') => {
    setStatus(nextStatus);
    if (source && !isForeign) setPaymentView(source);
    setTab('ledger');
  };
  const effectiveTab = (!canInspect && (tab === 'discrepancies' || tab === 'resolution')) || (userRole !== 'superadmin' && tab === 'resolution') ? 'overview' : tab;

  return <div className="space-y-6">
    <PageHeader title={title} description="Understand collections first. Open a receipt, follow up pending money, or compare the bank evidence." actions={<MinistrySubmissionCountdown />} />
    <Tabs value={effectiveTab} onValueChange={setTab} className="space-y-5">
    <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-2 lg:flex lg:justify-start">
      <TabsTrigger className="gap-2 rounded-xl px-5 py-3 text-base" value="overview"><ChartNoAxesCombined className="h-5 w-5" />Finance overview</TabsTrigger>
      <TabsTrigger className="gap-2 rounded-xl px-5 py-3 text-base" value="ledger"><List className="h-5 w-5" />Payments list</TabsTrigger>
      {canInspect && <TabsTrigger className="gap-2 rounded-xl px-5 py-3 text-base" value="discrepancies"><FileSearch className="h-5 w-5" />Bank & evidence</TabsTrigger>}
      {userRole === 'superadmin' && <TabsTrigger className="gap-2 rounded-xl px-5 py-3 text-base" value="resolution"><Scale className="h-5 w-5" />Resolve & protect</TabsTrigger>}
    </TabsList>
    {userRole === 'superadmin' && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-rose-500/5 p-4" aria-label="Payment resolution status">
      <div><h2 className="text-lg font-semibold">Automatic checks → Resolve & protect</h2><p className="text-sm text-muted-foreground">{reviewQueue.isLoading ? 'Checking current receipts and proof…' : `${summaryPayments.filter(payment => reviewQueue.data?.verified.has(payment.id)).length} receipts green-cleared in this scope · ${reviewQueue.data?.cases.length ?? 0} open cases · ${reviewQueue.data?.gaps.length ?? 0} amount signals portal-wide.`}</p><p className="mt-1 text-xs text-muted-foreground">Only verified settled money clears automatically. Holds still require an explicit reinstatement.</p></div>
      <Button variant={effectiveTab === 'resolution' ? 'default' : 'outline'} onClick={() => setTab('resolution')}><Scale className="mr-2 h-5 w-5" />Open Resolve & protect</Button>
      {reviewQueue.error && <p role="alert" className="w-full text-sm text-destructive">{reviewQueue.error.message}</p>}
    </section>}
    {(effectiveTab === 'overview' || effectiveTab === 'ledger') && <section className="space-y-4 rounded-2xl border bg-card/60 p-4" aria-label="Payment scope filters">
    {!isForeign && <div className="space-y-2">
      <p className="text-base font-semibold">Choose the payment flow</p>
      <ToggleGroup type="single" value={paymentView} onValueChange={value => { if (value === 'all' || value === 'foreign' || value === 'candidate') setPaymentView(value); }} variant="outline" className="grid w-full grid-cols-1 gap-3 md:grid-cols-3" aria-label="Filter payment source">
        <ToggleGroupItem value="all" aria-label={`All payments · ${payments.length}`} className={`${sourceTileClass} border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:text-slate-900 data-[state=on]:border-slate-600 data-[state=on]:bg-slate-200 data-[state=on]:text-slate-950 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-800 dark:data-[state=on]:text-white`}>
          <span className="control-nav-icon rounded-xl bg-slate-500/10 p-3"><Landmark className="h-8 w-8" /></span>
          <span className="relative z-10 min-w-0"><span className="block text-xl font-bold">All payments</span><span className="mt-1 block text-sm">Both flows in one view</span><span className="mt-2 block text-base font-semibold tabular-nums">{payments.length.toLocaleString()} receipts</span></span>
        </ToggleGroupItem>
        <ToggleGroupItem value="foreign" aria-label={`Foreign agency to local agency · ${foreignPayments.length}`} style={{ '--section-delay': '1.2s' } as React.CSSProperties} className={`${sourceTileClass} border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 hover:text-sky-950 data-[state=on]:border-sky-600 data-[state=on]:bg-sky-100 data-[state=on]:text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60 dark:data-[state=on]:bg-sky-900/70 dark:data-[state=on]:text-sky-100`}>
          <span className="control-nav-icon rounded-xl bg-sky-500/15 p-3"><Globe2 className="h-8 w-8" /></span>
          <span className="relative z-10 min-w-0"><span className="block text-xl font-bold">Foreign agency → local</span><span className="mt-1 flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 shrink-0" />Agency settlement<ArrowRight className="h-4 w-4 shrink-0" /></span><span className="mt-2 block text-base font-semibold tabular-nums">{foreignPayments.length.toLocaleString()} receipts</span></span>
        </ToggleGroupItem>
        <ToggleGroupItem value="candidate" aria-label={`Candidate to local agency · ${candidatePayments.length}`} style={{ '--section-delay': '2.4s' } as React.CSSProperties} className={`${sourceTileClass} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 data-[state=on]:border-emerald-600 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60 dark:data-[state=on]:bg-emerald-900/70 dark:data-[state=on]:text-emerald-100`}>
          <span className="control-nav-icon rounded-xl bg-emerald-500/15 p-3"><UserRound className="h-8 w-8" /></span>
          <span className="relative z-10 min-w-0"><span className="block text-xl font-bold">Candidate → local</span><span className="mt-1 flex items-center gap-2 text-sm"><Landmark className="h-4 w-4 shrink-0" />Candidate stage fees<ArrowRight className="h-4 w-4 shrink-0" /></span><span className="mt-2 block text-base font-semibold tabular-nums">{candidatePayments.length.toLocaleString()} receipts</span></span>
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
    <p className="text-xs text-muted-foreground">Source, search, recipient and dates apply to the overview and list. Status narrows the list only.</p>
    </section>}
    {isLoading && <p role="status" className="flex items-center gap-2 p-6"><Loader2 className="h-5 w-5 animate-spin" />Loading payment history…</p>}
    {isError && <div role="alert" className="rounded-xl border border-destructive p-4"><p>Could not load payment history.</p><Button variant="outline" onClick={() => void refetch()}>Retry payments</Button></div>}
    <TabsContent value="overview" className="space-y-5">{!isLoading && !isError && <PaymentHistoryOverview payments={summaryPayments} source={paymentView} agencies={getLocalAgencies()} onList={openList} onReceipt={inspectReceipt} onEvidence={canInspect ? () => setTab('discrepancies') : undefined} onResolution={userRole === 'superadmin' ? () => setTab('resolution') : undefined} />}</TabsContent>
    <TabsContent value="ledger" className="space-y-5">
    <PaymentLedgerSummary payments={summaryPayments} source={paymentView} status={status} onStatusChange={setStatus} />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Payments list</h2><p className="text-sm text-muted-foreground">{filtered.length} of {summaryPayments.length} receipts in scope · newest first</p></div><p className="text-xs text-muted-foreground">Click Investigate / View receipt for proof and history.</p></div>
    <Card><CardContent className="overflow-x-auto p-0">
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : isError ? <p role="alert" className="p-8 text-center text-destructive">Could not load payment history.</p>
          : filtered.length === 0 ? <p className="p-8 text-center text-muted-foreground">No payments match these filters.</p>
            : <Table><TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Payment source</TableHead><TableHead>Payer → recipient</TableHead><TableHead>Amount</TableHead><TableHead>Candidate count</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead><TableHead>Receipt</TableHead>
            </TableRow></TableHeader><TableBody>{[...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(payment => (
              <TableRow key={payment.id}>
                <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                <TableCell><Badge variant="outline">{isForeignPayment(payment) ? 'Foreign agency → local' : 'Candidate → local'}</Badge></TableCell>
                <TableCell><p className="text-sm font-medium"><EntityProfileButton kind="foreign-agency" entityId={isForeignPayment(payment) ? payment.payer_foreign_agency_id : undefined}>{payment.payer_display_name || (isForeignPayment(payment) ? getForeignAgencies().find(agency => agency.id === payment.payer_foreign_agency_id)?.name || 'Foreign agency not recorded' : 'Candidate')}</EntityProfileButton></p><p className="text-xs text-muted-foreground">→ <EntityProfileButton kind="local-agency" entityId={payment.payee_local_agency_id}>{getLocalAgencies().find(agency => agency.id === payment.payee_local_agency_id)?.name || 'Recipient not recorded'}</EntityProfileButton></p></TableCell>
                <TableCell className="tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</TableCell>
                <TableCell>{payment.candidate_ids.length}</TableCell>
                <TableCell><Badge variant="outline" className={payment.status === 'succeeded' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : payment.status === 'pending' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : payment.status === 'failed' ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{payment.receipt_number || payment.provider_reference || payment.id}</TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => inspectReceipt(payment)}>{userRole === 'superadmin' ? 'Investigate' : 'View receipt'}</Button></TableCell>
              </TableRow>
            ))}</TableBody></Table>}
    </CardContent></Card>
    </TabsContent>
    {canInspect && <TabsContent value="discrepancies" className="space-y-4">
      <ToggleGroup type="single" value={statementSource} onValueChange={value => { if (value) setStatementSource(value as typeof statementSource); }} variant="outline" className="justify-start" aria-label="Statement payment source"><ToggleGroupItem value="foreign">Foreign → local</ToggleGroupItem><ToggleGroupItem value="candidate">Candidate → local / ChechePay</ToggleGroupItem></ToggleGroup>
      {!isLocal && !isLocalStaff && <Select value={agency || 'all'} onValueChange={value => setAgency(value === 'all' ? '' : value)}><SelectTrigger aria-label="Recipient agency for statement review" className="w-full sm:w-96"><SelectValue placeholder="Select a recipient local agency" /></SelectTrigger><SelectContent><SelectItem value="all">All local agencies</SelectItem>{agencies.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>}
      {userRole === 'superadmin' && statementSource === 'foreign' && <AgencyPaymentReconciliation localAgencyId={reviewAgency || undefined} />}
      {statementSource === 'candidate' && <LocalPaymentEvidence key={reviewAgency || 'all'} localAgencyId={reviewAgency || (isLocal || isLocalStaff ? userLocalAgencyId ?? undefined : undefined)} />}
      {reviewAgency ? <>
        {statementSource === 'foreign' && userRole !== 'superadmin' && <AgencyPaymentReconciliation localAgencyId={reviewAgency} />}
        <BankReconciliation key={`${reviewAgency}:${statementSource}`} agencyId={reviewAgency} paymentSource={statementSource} allowActions={canReview} payments={(statementSource === 'foreign' ? foreignPayments : candidatePayments).filter(payment => payment.status === 'succeeded' && payment.payee_local_agency_id === reviewAgency)} />
      </> : <p className="text-sm text-muted-foreground">Choose a recipient agency to inspect contract-payment compliance and compare its settled transfers with its bank statement.</p>}
    </TabsContent>}
    {userRole === 'superadmin' && <TabsContent value="resolution"><div id="resolution"><AgencyResolutionCenter /></div></TabsContent>}
    </Tabs>
    {openReceipts.map(item => <PaymentReviewWindow key={item.payment.id} payment={payments.find(payment => payment.id === item.payment.id) ?? item.payment} payments={payments} activation={item.activation} canReview={canReview} onClose={() => setOpenReceipts(previous => previous.filter(other => other.payment.id !== item.payment.id))} />)}
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
