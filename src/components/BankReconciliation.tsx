import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Landmark, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Payment } from '@/lib/types';
import { BankLine, MatchStatus, parseStatementCsv, reconcile, summarizeReconciliation, type ReconciliationSummary } from '@/lib/bank-reconciliation';
import DocumentScanInput, { type ScanSelection } from '@/components/DocumentScanInput';
import type { UploadScanReport } from '@/lib/types';
import { loadBankStatement, removeBankStatement, saveBankStatement } from '@/lib/bank-statement-store';
import { loadReconciliationEvents } from '@/lib/bank-statement-store';
import type { PaymentStatementSource } from '@/lib/bank-statement-store';
import PaymentEvidenceReview, { type PaymentEvidence } from '@/components/PaymentEvidenceReview';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import EvidenceRequestList from './EvidenceRequestList';
import { getEvidenceRequests, EVIDENCE_STATUS_LABELS } from '@/lib/evidence-requests';
import { useSearchParams } from 'react-router-dom';
import { currentVerifiedPaymentIds } from '@/lib/payment-review-clearance';

const STATUS: Record<MatchStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  matched: { label: 'Payment entry matched', variant: 'default' },
  short: { label: 'Amount is lower', variant: 'destructive' },
  over: { label: 'Amount is higher', variant: 'secondary' },
  missing: { label: 'No matching bank entry', variant: 'destructive' },
  'reference-mismatch': { label: 'Reference differs', variant: 'destructive' },
  'currency-mismatch': { label: 'Currency differs', variant: 'destructive' },
};

export const BankReconciliation = ({ agencyId, payments, onSummaryChange, paymentSource = 'foreign', allowActions = true }: { agencyId: string; payments: Payment[]; paymentSource?: PaymentStatementSource; allowActions?: boolean; onSummaryChange?: (summary: ReconciliationSummary | null) => void }) => {
  const [statement, setStatement] = useState(() => loadBankStatement(agencyId, paymentSource));
  const [selection, setSelection] = useState<ScanSelection | null>(null);
  const [scanInputVersion, setScanInputVersion] = useState(0);
  const [view, setView] = useState('discrepancies');
  const [search, setSearch] = useState('');
  const [evidence, setEvidence] = useState<PaymentEvidence | null>(null);
  const [events, setEvents] = useState(() => loadReconciliationEvents(agencyId));
  const [params] = useSearchParams();
  useEffect(() => {
    const refresh = () => { setStatement(loadBankStatement(agencyId, paymentSource)); setEvents(loadReconciliationEvents(agencyId)); };
    refresh(); setEvidence(null); setSearch('');
    window.addEventListener('bank-statement-changed', refresh);
    window.addEventListener('storage', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('storage', refresh); window.clearInterval(timer); };
  }, [agencyId, paymentSource]);
  const result = useMemo(() => (statement ? reconcile(payments, statement.lines) : null), [payments, statement]);
  const summary = useMemo(() => result ? summarizeReconciliation(result) : null, [result]);
  useEffect(() => { onSummaryChange?.(summary); }, [onSummaryChange, summary]);

  const importStatement = async () => {
    if (!allowActions || !selection?.ready) return;
    try {
      const lines = parseStatementCsv(await selection.file.text());
      const next = { name: selection.file.name, lines, scan_report: selection.report };
      saveBankStatement(agencyId, next, paymentSource);
      setStatement(next);
      setSelection(null);
      setScanInputVersion(version => version + 1);
      toast.success(`Imported ${lines.length} credit entries from ${selection.file.name}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const clear = () => { removeBankStatement(agencyId, paymentSource); setStatement(null); setSelection(null); setScanInputVersion(version => version + 1); };
  const verified = currentVerifiedPaymentIds();
  const problems = result ? result.matches.filter(m => m.status !== 'matched' || !verified.has(m.payment.id)).length + result.unrecognized.length : 0;
  const query = search.trim().toLowerCase();
  const visibleMatches = result?.matches.filter(match => (
    view === 'all' || (view === 'discrepancies' && (match.status !== 'matched' || !verified.has(match.payment.id))) ||
    (view === 'issues' && ['short', 'over', 'reference-mismatch', 'currency-mismatch'].includes(match.status)) ||
    view === match.status
  ) && `${match.payment.provider_reference} ${match.payment.receipt_number} ${match.payment.payer_display_name} ${match.payment.amount} ${match.status} ${match.explanation}`.toLowerCase().includes(query)) ?? [];
  const visibleCredits = ['all', 'discrepancies', 'unassigned'].includes(view)
    ? result?.unrecognized.filter(line => `${line.reference} ${line.description} ${line.amount}`.toLowerCase().includes(query)) ?? [] : [];
  const creditId = (line: BankLine) => `${paymentSource}:credit:${JSON.stringify(line)}`;
  const requests = getEvidenceRequests(events, new Date(), verified);
  const caseState = (id: string) => {
    if (verified.has(id)) return 'Automatically cleared after all checks';
    const request = requests.find(item => item.event.caseId === id);
    return request ? EVIDENCE_STATUS_LABELS[request.status] : events.filter(event => event.caseId === id).at(-1)?.action ?? 'Not reviewed';
  };
  const requestedCase = params.get('case');
  useEffect(() => {
    if (!requestedCase) return;
    const event = loadReconciliationEvents(agencyId).find(item => item.caseId === requestedCase && (!item.source || item.source === paymentSource));
    if (event) setEvidence({ caseId: event.caseId, payment: event.evidence.payment, line: event.evidence.line, explanation: event.evidence.explanation, source: paymentSource });
  }, [requestedCase, agencyId, paymentSource]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4" />Compare payments with bank records</CardTitle>
        <div className="flex items-center gap-2">
          {statement && allowActions && <Button size="sm" variant="ghost" onClick={clear}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">We compare payment receipts marked received with credit entries in the uploaded file. A possible match is a clue, not bank confirmation. Check the amount, currency and payment reference before clearing a payment.</p>
        {statement?.synthetic && <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><strong>DEMO / synthetic bank records.</strong> Covers {statement.covered_candidate_ids?.length ?? 0} candidates. Deliberate shortages, overpayments and missing evidence are included. This is not real bank proof; unpaid transfers have no invented deposits.</p>}
        <EvidenceRequestList events={events} source={paymentSource} onReview={event => setEvidence({ caseId: event.caseId, payment: event.evidence.payment, line: event.evidence.line, explanation: event.evidence.explanation, source: paymentSource })} />
        {allowActions && <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <DocumentScanInput
            key={scanInputVersion}
            id="bank-reconciliation-file"
            accept=".csv,text/csv"
            disabled={false}
            onChange={setSelection}
          />
          <Button onClick={importStatement} disabled={!selection?.ready}>Compare bank file</Button>
        </div>}
        {!statement || !result ? (
          <p className="text-sm text-muted-foreground">No bank file uploaded yet. Upload the agency’s file above to compare it with these payment receipts.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{statement.name}</Badge>
              {statement.scan_report && <Badge variant={statement.scan_report.status === 'review' ? 'secondary' : 'outline'}>Screening {statement.scan_report.status}</Badge>}
              <Badge variant={problems ? 'destructive' : 'default'}>{problems ? `${problems} items to check` : 'All payments checked'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 border-y py-3 text-sm sm:grid-cols-4">
              {[
                { key: 'matched', label: 'Payment entries matched', count: summary?.matched },
                { key: 'issues', label: 'Amount or details differ', count: (summary?.short ?? 0) + (summary?.over ?? 0) + (summary?.['currency-mismatch'] ?? 0) + (summary?.['reference-mismatch'] ?? 0) },
                { key: 'missing', label: 'No matching bank entry', count: summary?.missing },
                { key: 'unassigned', label: 'Bank credits without a payment', count: summary?.unrecognizedDeposits },
              ].map(item => <button type="button" key={item.key} aria-pressed={view === item.key} className={`rounded-lg border p-3 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${view === item.key ? 'border-primary bg-primary/5' : ''}`} onClick={() => setView(view === item.key ? 'all' : item.key)}>
                <p className="text-muted-foreground">{item.label}</p><p className="text-xl font-semibold">{item.count}</p>
              </button>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ToggleGroup type="single" value={view} onValueChange={value => { if (value) setView(value); }} variant="outline" aria-label="Reconciliation view">
                <ToggleGroupItem value="discrepancies">Needs review · {problems}</ToggleGroupItem>
                <ToggleGroupItem value="all">All payment records</ToggleGroupItem>
              </ToggleGroup>
              <Input aria-label="Search payment and bank records" placeholder="Reference, receipt, payer or status" className="w-full sm:w-80" value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Payment reference / receipt</TableHead><TableHead>On receipt</TableHead><TableHead>In uploaded file</TableHead><TableHead>Difference</TableHead><TableHead>Result</TableHead><TableHead>Review status</TableHead><TableHead>Action</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMatches.map(m => (
                    <TableRow key={m.payment.id}>
                      <TableCell><p>{m.payment.provider_reference || m.payment.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{m.payment.receipt_number || 'No receipt number'}</p></TableCell>
                      <TableCell>{m.payment.amount.toLocaleString()} {m.payment.currency}</TableCell>
                      <TableCell>{m.line ? `${m.line.amount.toLocaleString()} ${m.line.currency || m.payment.currency} · ${m.line.date}` : '—'}</TableCell>
                      <TableCell>{m.currencyMismatch ? 'Not comparable' : `${m.difference.toLocaleString()} ${m.payment.currency}`}</TableCell>
                      <TableCell><Badge variant={STATUS[m.status].variant}>{m.currencyMismatch ? 'Currency differs' : STATUS[m.status].label}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{caseState(m.payment.id).replace('-', ' ')}</TableCell>
                      <TableCell><Button size="sm" variant="outline" aria-label={`Review payment ${m.payment.provider_reference || m.payment.id}`} onClick={() => setEvidence({ caseId: m.payment.id, match: m, source: paymentSource })}>Review</Button></TableCell>
                    </TableRow>
                  ))}
                  {visibleCredits.map((l, i) => (
                    <TableRow key={`u${i}`}>
                      <TableCell>{l.reference || l.description || 'Deposit'}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>{l.amount.toLocaleString()} {l.currency} · {l.date}</TableCell>
                      <TableCell>+{l.amount.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />No matching payment</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{caseState(creditId(l)).replace('-', ' ')}</TableCell>
                      <TableCell><Button size="sm" variant="outline" aria-label={`Review deposit ${l.reference || l.description}`} onClick={() => setEvidence({ caseId: creditId(l), line: l, source: paymentSource })}>Review</Button></TableCell>
                    </TableRow>
                  ))}
                  {!visibleMatches.length && !visibleCredits.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No evidence matches this view.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
      <PaymentEvidenceReview agencyId={agencyId} evidence={evidence} statementName={statement?.name ?? 'No statement'} allowActions={allowActions} onClose={() => setEvidence(null)} />
    </Card>
  );
};
