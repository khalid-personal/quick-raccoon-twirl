import { QrCode, ShieldCheck } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import { Badge } from './ui/badge';

export default function MinistryQrPanel({ candidate }: { candidate: Candidate; onChanged?: () => void }) {
  const ministry = candidate.clearance?.labour_ministry;
  return <section aria-label="Labour Ministry QR" className="ministry-stage-summary">
    <h3 className="flex items-center gap-2"><QrCode className="text-primary" />Ministry deployment reference</h3>
    <div className="flex flex-wrap items-center gap-3"><Badge variant="outline"><ShieldCheck className="mr-2 h-4 w-4" />Ministry-owned</Badge><span>{ministry?.status || 'Awaiting ministry issuance'}</span></div>
    <dl><dt>QR / certificate number</dt><dd className="break-all">{ministry?.certificate_no || 'Awaiting ministry reference'}</dd></dl>
    {ministry?.issued_at && <p className="text-muted-foreground">Issued {new Date(ministry.issued_at).toLocaleString()}</p>}
  </section>;
}
