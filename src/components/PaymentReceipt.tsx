import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_STAGES, type Payment } from '@/lib/types';
import { getCandidates, getForeignAgencies, getLocalAgencies } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChechePayBrand from './ChechePayBrand';

export default function PaymentReceipt({ payment, open, onOpenChange, outbound = false }: { payment: Payment | null; open: boolean; onOpenChange: (open: boolean) => void; outbound?: boolean }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  if (!payment) return null;
  const candidate = getCandidates().find(record => record.id === payment.payer_candidate_id);
  const payer = payment.payer_display_name || (candidate ? `${candidate.first_name} ${candidate.last_name}` : getForeignAgencies().find(agency => agency.id === payment.payer_foreign_agency_id)?.name) || 'Payer not recorded';
  const payee = getLocalAgencies().find(agency => agency.id === payment.payee_local_agency_id)?.name || 'Recipient not recorded';
  const confirmation = payment.chechepay_receipt;
  const print = () => {
    if (!receiptRef.current) return;
    const output = window.open('', '_blank', 'width=850,height=900');
    if (!output) { toast.error('Allow pop-ups to print this receipt.'); return; }
    output.document.write(`<!doctype html><html><head><base href="${window.location.origin}/"><title>Payment receipt</title><style>body{font-family:sans-serif;margin:40px;color:#111}dl>div{padding:10px 0;border-bottom:1px solid #ddd}dt{font-size:12px;color:#555}dd{margin:3px 0;overflow-wrap:anywhere}h2{font-size:20px}p{font-size:13px}.chechepay-brand{display:flex;align-items:center;gap:12px;background:white;border-bottom:2px solid #cc206c;color:#0d2991;padding:12px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.chechepay-brand img{width:160px;height:80px;object-fit:contain}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    output.document.close(); output.focus(); output.print();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="chechepay-theme max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Payment receipt</DialogTitle><DialogDescription>{outbound ? 'Your outbound transfer receipt, generated from the saved transaction record.' : 'Portal receipt generated from the saved transaction record. It is not a ChechePay-issued PDF or proof of a matching bank deposit.'}</DialogDescription></DialogHeader>
    <div ref={receiptRef} className="space-y-4">
      {payment.provider === 'chechepay' && <ChechePayBrand label="Portal receipt · payment provider" />}
      <h2 className="text-xl font-semibold">{payment.provider === 'chechepay' ? 'ChechePay payment confirmation' : payment.provider === 'mock' ? 'Demo payment receipt' : 'Recorded payment receipt'}</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ['Portal receipt number', payment.receipt_number || payment.id], ['Payer', payer], ['Recipient local agency', payee],
          ['Stage', ALL_STAGES.find(stage => stage.id === payment.stage_id)?.title || 'Agency transfer'],
          ['Amount', `${payment.amount.toLocaleString()} ${payment.currency}`], ['Status', payment.status],
          ['Provider transfer reference', payment.provider_reference || 'Not recorded'], ['Recorded at', new Date(payment.created_at).toLocaleString()],
        ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value}</dd></div>)}
      </dl>
      {confirmation ? <section className="border-t pt-3"><h3 className="text-sm font-semibold">Saved ChechePay confirmation</h3><dl className="mt-2 space-y-2 text-sm">
        <div><dt className="text-muted-foreground">ChechePay transaction reference</dt><dd className="break-all font-mono">{confirmation.transaction_reference}</dd></div>
        <div><dt className="text-muted-foreground">Processor reference</dt><dd>{confirmation.processor_reference || 'Not returned by provider'}</dd></div>
        <div><dt className="text-muted-foreground">Confirmed amount / status</dt><dd>{confirmation.amount.toLocaleString()} {confirmation.currency} · {confirmation.status}</dd></div>
        <div><dt className="text-muted-foreground">Server verified at</dt><dd>{new Date(confirmation.verified_at).toLocaleString()}</dd></div>
      </dl></section> : <p className="text-sm text-muted-foreground">{outbound ? 'This receipt records the transfer details saved in the portal.' : 'No full provider confirmation snapshot is stored for this record. Do not treat this portal receipt as provider-issued evidence.'}</p>}
      {!outbound && <p className="text-xs text-muted-foreground">Bank settlement must be checked independently against the receiving account statement.</p>}
    </div>
    <Button variant="outline" onClick={print}><Printer className="mr-2 h-4 w-4" />Print receipt</Button>
  </DialogContent></Dialog>;
}