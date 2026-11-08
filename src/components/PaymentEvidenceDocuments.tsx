import { useId, useState } from 'react';
import { Download, Eye, Landmark, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildPaymentEvidencePdf, paymentEvidenceComparison, type PaymentEvidenceComparisonInput } from '@/lib/payment-evidence-pdf';

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
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="motion-reduce:transition-none" aria-expanded={expanded} aria-controls={comparisonId} onClick={() => setExpanded(value => !value)}>
        <Eye className="mr-2 h-4 w-4" />{expanded ? 'Hide comparison' : 'View comparison'}
      </Button>
      <Button size="sm" variant="outline" className="motion-reduce:transition-none" disabled={downloading} onClick={download}><Download className="mr-2 h-4 w-4" />{downloading ? 'Preparing comparison PDF…' : 'Download comparison PDF'}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-2 md:grid-cols-3" aria-label="Evidence comparison checks">
      {comparison.checks.map(check => <div key={check.label} className={`rounded-lg border p-3 text-sm ${checkStyle[check.status]}`}>
        <p className="font-semibold">{check.label}: {check.status === 'missing' ? 'Missing proof' : check.status === 'match' ? 'Match' : 'Mismatch'}</p>
        <p className="mt-1 break-words text-xs">{check.detail}</p>
      </div>)}
    </div>
    <div id={comparisonId} hidden={!expanded} className="grid items-start gap-4 md:grid-cols-2">
      <article className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="h-5 w-5 text-sky-600" />1. Full saved payment receipt</h3>
        {payment ? <>
          <p className="text-2xl font-semibold">{payment.amount.toLocaleString()} {payment.currency}</p>
          {payment.provider === 'mock' && <Badge variant="outline">DEMO / synthetic receipt</Badge>}
          {payment.demo_evidence && <div className="space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3" aria-label="Demo investigator identity links">
            <h4 className="font-semibold">{payment.demo_evidence.bank_name} · synthetic confirmation</h4>
            {payment.demo_evidence.identities.map(identity => <div key={identity.candidate_id} className="text-sm"><p className="font-medium">{identity.name}</p><p className="text-xs text-muted-foreground">{identity.tracking_code} · Passport {identity.passport_number}</p></div>)}
            <p className="text-xs text-muted-foreground">Recorded fictional identities for investigation practice, not a fraud-free identity certification.</p>
          </div>}
          <dl className="space-y-2 text-sm">{comparison.receiptRows.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all whitespace-pre-wrap">{value}</dd></div>)}</dl>
        </> : <p className="text-sm text-amber-700">No payment receipt is recorded. Request it; do not invent one.</p>}
        <p className="text-xs text-muted-foreground">Portal transaction record, not a provider-issued original document.</p>
      </article>
      <article className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Landmark className="h-5 w-5 text-violet-600" />2. Full imported bank statement</h3>
        {statement ? <>
          <p className="break-words text-sm font-medium">{statement.name}</p>
          {statement.synthetic && <Badge variant="outline">DEMO / synthetic evidence</Badge>}
          <dl className="space-y-2 text-sm">{comparison.statementRows.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>
          <p className="text-sm">All imported credit rows ({statement.lines.length}); the comparison row is highlighted below.</p>
          <div className="max-h-[36rem] overflow-auto"><table className="w-full text-left text-xs">
            <caption className="sr-only">All imported statement credits; highlighted row is the linked comparison, not authentication.</caption>
            <thead><tr><th scope="col" className="p-2">Date</th><th scope="col" className="p-2">Description / reference</th><th scope="col" className="p-2">Credit / currency</th></tr></thead>
            <tbody>{statement.lines.map((line, index) => <tr id={`${comparisonId}-row-${index}`} key={`${comparisonId}-${index}`} className={`border-t ${index === comparison.linkedIndex ? 'bg-sky-50 dark:bg-sky-950' : ''}`}>
              <td className="p-2">{line.date}{index === comparison.linkedIndex && <span className="block font-semibold">Linked comparison row</span>}</td>
              <td className="break-all p-2"><p>{line.description}</p><p className={`rounded p-1 ${index === comparison.linkedIndex ? checkStyle[comparison.checks[2].status] : ''}`}>Reference: {line.reference || 'Not supplied'}</p></td>
              <td className="p-2"><span className={`block rounded p-1 ${index === comparison.linkedIndex ? checkStyle[comparison.checks[0].status] : ''}`}>{line.amount.toLocaleString()}</span><span className={`block rounded p-1 ${index === comparison.linkedIndex ? checkStyle[comparison.checks[1].status] : ''}`}>{line.currency || 'Not supplied'}</span></td>
            </tr>)}</tbody>
          </table></div>
        </> : <p className="text-sm text-amber-700">No statement uploaded for this agency and payment source.</p>}
        <p className="text-xs text-muted-foreground">{statement?.synthetic && statement.demo_original?.complete ? 'Complete fictional demo statement. All generated credits and zero simulated debits are recorded; currencies have separate balances. Not bank-authenticated.' : 'Imported credit-row data, not a bank-authenticated statement or original PDF. Original debits and omitted source rows are unavailable.'}</p>
      </article>
    </div>
    <div className="space-y-1 text-xs text-muted-foreground" aria-label="Evidence limitations">
      {comparison.warnings.map(warning => <p key={warning}>{warning}</p>)}
    </div>
  </section>;
}
