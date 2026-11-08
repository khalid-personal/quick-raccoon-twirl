import { useState } from 'react';
import { Clock3, Download, Loader2, QrCode, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { clearanceBlockers, clearCandidate, isCleared, simulateMinistryQrIssuance } from '@/lib/ksa-visa';
import type { Candidate } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function MinistryQrPanel({ candidate, onChanged }: { candidate: Candidate; onChanged?: () => void }) {
  const { user, userRole, userLocalAgencyId } = useAuth();
  const [busy, setBusy] = useState(false);
  const ministry = candidate.clearance?.labour_ministry;
  const official = isCleared(candidate);
  const simulated = !!ministry?.simulated;
  const secureImage = ministry?.qr_image_url && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(ministry.qr_image_url) || /^https:\/\//i.test(ministry.qr_image_url));
  const image = ministry?.status === 'cleared' && secureImage ? ministry.qr_image_url : undefined;
  const rejected = ministry?.status === 'rejected' || ministry?.status === 'error';
  const blockers = clearanceBlockers(candidate);
  const ready = !!candidate.clearance?.local_ready_at;
  const canSimulate = isDemoMode() && candidate.id.startsWith('demo-') && (userRole === 'superadmin'
    || (userRole === 'local-agency' && candidate.local_agency_id === userLocalAgencyId));
  const label = official ? 'Official ministry QR issued' : simulated && image ? 'Demo QR issued / not official'
    : rejected ? 'Ministry review failed' : ministry?.status === 'cleared' ? 'Issued record needs verification' : ready ? 'Pending ministry QR' : 'Local clearance checks incomplete';
  const Icon = official || image ? ShieldCheck : rejected ? TriangleAlert : Clock3;
  const simulate = async () => {
    setBusy(true);
    try {
      if (!user?.id || !user.email) throw new Error('Sign in before simulating clearance.');
      const actor = { id: user.id, email: user.email };
      if (!ready) await clearCandidate(candidate, actor);
      await simulateMinistryQrIssuance(candidate, actor);
      onChanged?.();
      window.dispatchEvent(new CustomEvent('supabase-data-changed'));
      toast.success('Demo QR issued and audit logged. It is not official ministry clearance.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Ministry QR simulation failed.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Labour Ministry QR" className={`rounded-xl border p-4 ${official ? 'border-emerald-500/30 bg-emerald-500/5' : rejected ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2"><h3 className="flex items-center gap-2 font-semibold"><QrCode className="h-5 w-5" />Labour Ministry clearance QR</h3><Badge variant="outline" className="gap-1"><Icon className="h-3.5 w-3.5" />{label}</Badge>
        <p className="max-w-xl text-sm text-muted-foreground">{ministry?.message || (ready ? 'Local checks are finished. The ministry must issue the QR before official clearance can be claimed.' : 'Complete visa, Enjaz and Tasheer checks before requesting ministry issuance.')}</p>
        {blockers.length > 0 && <p className="text-xs text-muted-foreground">Still needed: {blockers.join(', ')}.</p>}
        {ministry?.certificate_no && <p className="font-mono text-sm">{ministry.certificate_no}</p>}
        {ministry?.issued_at && <p className="text-xs text-muted-foreground">Issued {new Date(ministry.issued_at).toLocaleString()}</p>}
        {image && <Button asChild size="sm" variant="outline"><a href={image} download={`ministry-qr-${candidate.tracking_code}.png`}><Download className="mr-2 h-4 w-4" />Download {simulated ? 'demo ' : ''}QR</a></Button>}
        {canSimulate && !image && !rejected && <Button disabled={busy || blockers.length > 0} size="sm" variant="outline" onClick={simulate}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}Simulate demo ministry QR · audit logged</Button>}
      </div>
      {image ? <figure className="space-y-1 rounded-lg border bg-white p-3"><img src={image} className="h-36 w-36 object-contain" alt={simulated ? 'DEMO simulated ministry QR, not an official certificate' : official ? 'Official Labour Ministry verification QR' : 'Recorded ministry QR, clearance checks incomplete'} /><figcaption className="max-w-36 text-center text-xs text-slate-700">{simulated ? 'DEMO / NOT OFFICIAL' : official ? 'Ministry verification QR' : 'Verification incomplete'}</figcaption></figure>
        : <div className="flex h-36 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-xs text-muted-foreground"><QrCode className="h-10 w-10 opacity-30" />No QR issued yet</div>}
    </div>
  </section>;
}
