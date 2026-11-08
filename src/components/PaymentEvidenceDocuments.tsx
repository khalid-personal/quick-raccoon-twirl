import { useId, useState } from 'react';
import { Download, Eye, Landmark, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildPaymentEvidencePdf, paymentEvidenceComparison, type PaymentEvidenceComparisonInput } from '@/lib/payment-evidence-pdf';
import { getCandidates } from '@/lib/data-store';
import { paymentReferences } from '@/lib/bank-reconciliation';
import CandidateAvatar from './CandidateAvatar';

const checkStyle = {
  match: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  mismatch: 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
  missing: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
};

export default function PaymentEvidenceDocuments({ payment, statement, match }: PaymentEvidenceComparisonInput & {
  /** Compatibility only; comparisons never open a secondary receipt popup. */
  onReceipt?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const comparisonId = useId();
  const comparison = paymentEvidenceComparison({ payment, statement, match });
  const line = comparison.linkedIndex >= 0 ? statement?.lines[comparison.linkedIndex] : undefined;
  const candidates = getCandidates();
  const candidateIds = [...new Set(payment?.candidate_ids ?? [])];
  const linkedCandidates = candidateIds.map(id => candidates.find(candidate => candidate.id === id));
  const identityChanged = linkedCandidates.some(candidate => {
    const snapshot = payment?.demo_evidence?.identities.find(identity => identity.candidate_id === candidate?.id);
    return candidate && snapshot && (snapshot.name !== `${candidate.first_name} ${candidate.last_name}`
      || snapshot.tracking_code !== candidate.tracking_code || snapshot.passport_number !== candidate.passport_number);
  });
  const transactionId = line && match?.payment.id === payment?.id && match?.matchedReference && payment && paymentReferences(payment).includes(match.matchedReference)
    ? match.matchedReference : payment?.provider_reference || payment?.chechepay_receipt?.transaction_reference
      || payment?.chechepay_receipt?.processor_reference || payment?.receipt_number;
  const fieldLabels = ['Amount', 'Currency', 'Transaction ID'];
  const receiptValues = [payment?.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), payment?.currency, transactionId];
  const bankValues = [line?.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), line?.currency,
    line?.reference || (comparison.checks[2].status === 'match' ? 'Reference found in bank description' : undefined)];
  const fields = (values: (string | undefined)[]) => <dl className="space-y-3">{[2, 0, 1].map(index => <div key={fieldLabels[index]} className={`rounded-xl border p-3 ${checkStyle[comparison.checks[index].status]}`}>
    <dt className="text-xs font-semibold uppercase tracking-wide">{fieldLabels[index]}</dt>
    <dd className="mt-1 break-words text-lg font-semibold tabular-nums">{values[index] || 'Not recorded'}</dd>
  </div>)}</dl>;
  const download = async () => {
    setDownloading(true); setError('');
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      const bytes = await buildPaymentEvidencePdf({ payment, statement, match });
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `payment-comparison-${(payment?.id || 'missing-receipt').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(anchor); anchor.click();
    } catch {
      const message = 'Could not download the comparison PDF. Please retry; no evidence was changed.';
      setError(message); toast.error(message);
    } finally {
      anchor?.remove();
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
      setDownloading(false);
    }
  };
  return <section aria-label="Receipt and bank statement side by side" className="space-y-4">
    <div aria-label="Candidate linked to this transaction" className="rounded-xl border bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{candidateIds.length > 1 ? 'Candidates covered by this transfer' : 'Candidate'}</p>
      {!candidateIds.length && <p role="alert" className="mt-2 text-sm text-amber-700">No candidate is linked to this transaction. Confirm the candidate before reviewing it.</p>}
      {linkedCandidates.map((candidate, index) => candidate ? <div key={candidate.id} className="mt-3 flex items-center gap-3">
        <CandidateAvatar candidate={candidate} className="h-11 w-11 shrink-0" />
        <div><p className="font-semibold">{candidate.first_name} {candidate.last_name}</p><p className="text-sm text-muted-foreground">{candidate.tracking_code} · Passport {candidate.passport_number || 'not recorded'}</p></div>
      </div> : <p key={index} role="alert" className="mt-2 text-sm text-amber-700">A linked candidate is no longer available. Resolve the candidate link before confirming this transfer.</p>)}
      {identityChanged && <p role="alert" className="mt-3 text-sm text-amber-700">The saved receipt identity differs from the current candidate profile. Check the original receipt before confirming.</p>}
      {(statement?.synthetic || payment?.demo_evidence || payment?.provider === 'mock') && <Badge variant="outline" className="mt-3">Practice evidence · not bank-confirmed</Badge>}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="motion-reduce:transition-none" aria-expanded={expanded} aria-controls={comparisonId} onClick={() => setExpanded(value => !value)}>
        <Eye className="mr-2 h-4 w-4" />{expanded ? 'Hide comparison' : 'View comparison'}
      </Button>
      <Button size="sm" variant="outline" className="motion-reduce:transition-none" disabled={downloading} onClick={download}><Download className="mr-2 h-4 w-4" />{downloading ? 'Preparing comparison PDF…' : 'Download comparison PDF'}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-2 md:grid-cols-3" aria-label="Evidence comparison checks">
      {[2, 0, 1].map(index => { const check = comparison.checks[index]; return <div key={check.label} className={`rounded-lg border p-3 text-sm ${checkStyle[check.status]}`}>
        <p className="font-semibold">{fieldLabels[index]}: {check.status === 'missing' ? 'Missing proof' : check.status === 'match' ? 'Match' : 'Mismatch'}</p>
        <p className="mt-1 break-words text-xs">Receipt: {receiptValues[index] || 'Not recorded'}<br />Bank: {bankValues[index] || 'Not recorded'}</p>
        {index === 0 && comparison.checks[1].status !== 'match' && <p className="mt-1 text-xs">Confirm the currency before comparing amounts.</p>}
      </div>; })}
    </div>
    <div id={comparisonId} hidden={!expanded} className="grid items-start gap-4 md:grid-cols-2">
      <article className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="h-5 w-5 text-sky-600" />1. Saved payment receipt</h3>
        {payment ? <>
          {fields(receiptValues)}
        </> : <p className="text-sm text-amber-700">No payment receipt is recorded. Request it; do not invent one.</p>}
        <p className="text-xs text-muted-foreground">This is the portal’s saved payment record, not an original document from the payment provider.</p>
      </article>
      <article className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Landmark className="h-5 w-5 text-violet-600" />2. Bank records from the uploaded file</h3>
        {statement ? <>
          {fields(bankValues)}
          {!line && <p role="alert" className="text-sm text-amber-700">No bank entry is linked to this receipt. Do not assume a payment of zero.</p>}
          {match?.matchBasis === 'amount-date' && <p role="alert" className="text-sm text-amber-700">Suggested bank entry only. The transaction ID has not been matched.</p>}
        </> : <p className="text-sm text-amber-700">No statement uploaded for this agency and payment source.</p>}
        <p className="text-xs text-muted-foreground">Only the bank entry compared with this receipt is shown. Matching fields do not authenticate the bank file.</p>
      </article>
    </div>
    {statement && <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Other bank entries · {statement.lines.length} entries in this file</summary>
      <p className="mt-2 break-words text-xs text-muted-foreground">{statement.name} · These entries are not all payments for the selected candidate.</p>
      <div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Full statement entries for audit; not all linked to this candidate.</caption>
        <thead><tr>{['Transaction ID', 'Amount', 'Currency'].map(label => <th key={label} className="p-2" scope="col">{label}</th>)}</tr></thead>
        <tbody>{statement.lines.map((entry, index) => <tr key={index} className={`border-t ${index === comparison.linkedIndex ? 'bg-primary/5 font-semibold' : ''}`}>
          <td className="break-words p-2">{entry.reference || 'Not recorded'}{index === comparison.linkedIndex && <span className="block text-xs text-primary">Compared entry</span>}</td>
          <td className="p-2 tabular-nums">{entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-2">{entry.currency || 'Not recorded'}</td>
        </tr>)}</tbody>
      </table></div>
    </details>}
    <details className="space-y-1 text-xs text-muted-foreground" aria-label="Evidence limitations"><summary className="cursor-pointer">Evidence limitations and original record details</summary>
      {comparison.warnings.map(warning => <p key={warning}>{warning}</p>)}
    </details>
  </section>;
}
