import React, { useRef, useState } from 'react';
import { BookUser, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fileToDataUrl, resolvePassportImage } from '@/lib/candidate-images';
import { scanDocumentFile } from '@/lib/document-screening';
import { Badge } from '@/components/ui/badge';
import type { Candidate } from '@/lib/types';

interface Props {
  candidate: Pick<Candidate, 'id' | 'first_name' | 'last_name' | 'passport_number' | 'dob' | 'passport_image_url' | 'passport_image_scan_report'>;
  canEdit?: boolean;
  onChanged?: () => void;
}

const PassportButton: React.FC<Props> = ({ candidate, canEdit = false, onChanged }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const image = resolvePassportImage(candidate);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const scanReport = await scanDocumentFile(file);
      if (scanReport.status === 'blocked') throw new Error(scanReport.findings.join(' '));
      const dataUrl = await fileToDataUrl(file, 1400, 0.82);
      await api.updateCandidateDetails(candidate.id, { passport_image_url: dataUrl, passport_image_scan_report: scanReport }, user?.id || 'unknown', user?.email || 'unknown');
      if (scanReport.status === 'review') toast.warning(`Passport image saved for compliance review: ${scanReport.findings.join(' ')}`);
      else toast.success('Passport image screened and saved.');
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${image ? 'text-primary' : 'text-muted-foreground/50'}`}
              aria-label="View passport"
              onClick={(e) => e.stopPropagation()}
            >
              <BookUser className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{image ? 'View passport' : 'No passport image'}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Passport · {candidate.first_name} {candidate.last_name}</DialogTitle>
          <DialogDescription>Passport no. {candidate.passport_number}</DialogDescription>
        </DialogHeader>
        {candidate.passport_image_url === 'generated' ? <div className="space-y-2 rounded-xl border border-dashed bg-muted/30 p-6"><Badge variant="outline">Fictional / synthetic record</Badge><p className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</p><p className="font-mono text-sm">{candidate.passport_number}</p><p className="text-sm">Date of birth: {candidate.dob}</p><p className="text-xs text-muted-foreground">No real passport image is stored for this fictional candidate.</p></div> : image ? (
          <img src={image} alt="Passport" className="w-full rounded-md border bg-muted object-contain" />
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No passport image has been uploaded yet.</div>
        )}
        {candidate.passport_image_scan_report?.status === 'review' && <Badge variant="outline" className="border-amber-400 text-amber-700">Passport image flagged for review</Badge>}
        {canEdit && (
          <>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {image ? 'Replace image' : 'Upload image'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PassportButton;
