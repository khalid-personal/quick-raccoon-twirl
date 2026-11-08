import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PassportPrefill } from '@/components/NewCandidateForm/index';
import type { UploadScanReport } from '@/lib/types';
import { Loader2, ShieldCheck, Upload } from 'lucide-react';
import { scanPassport } from '@/lib/passport-scan';

export interface PassportScanResult {
  data: PassportPrefill;
  imageUrl: string;
  screeningReport: UploadScanReport;
}

interface PassportScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scan: PassportScanResult) => void;
}

const PassportScanDialog: React.FC<PassportScanDialogProps> = ({ open, onOpenChange, onConfirm }) => {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [data, setData] = useState<PassportPrefill>({});
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screeningReport, setScreeningReport] = useState<UploadScanReport | null>(null);

  const applyFile = async (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      setImageUrl('');
      setData({});
      setProgress(0);
      setError(null);
      setScreeningReport(null);
      return;
    }

    setFile(nextFile);
    setScanning(true);
    setError(null);
    setProgress(0);
    setScreeningReport(null);

    try {
      const result = await scanPassport(nextFile, nextProgress => setProgress(nextProgress));

      setImageUrl(result.imageUrl);
      setData(result.data);
      setScreeningReport(result.screeningReport);
    } catch (scanError) {
      setImageUrl('');
      setData({});
      setError(scanError instanceof Error ? scanError.message : 'Passport scan could not be completed.');
    } finally {
      setScanning(false);
    }
  };

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setFile(null);
      setData({});
      setImageUrl('');
      setProgress(0);
      setError(null);
      setScreeningReport(null);
    }
  };

  const update = <Key extends keyof PassportPrefill>(key: Key, value: NonNullable<PassportPrefill[Key]>) => setData(current => ({ ...current, [key]: value }));

  const canSubmit = !!file && !!imageUrl && !!data.first_name && !!data.last_name && !!data.dob && !!data.passport_number && !!data.gender && !scanning;

  const reportStatus = screeningReport?.status === 'clear' ? 'Passport image cleared screening' : screeningReport?.status === 'review' ? 'Passport image passed basic screening, please verify details.' : screeningReport?.status === 'blocked' ? 'Passport upload was blocked by the security scan.' : null;

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Review passport details</DialogTitle>
        <DialogDescription>Upload a passport image or PDF up to 15 MB and verify the details before using them to create the candidate record.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {!file ? (
          <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center transition-all hover:border-primary hover:bg-primary/10 hover:shadow-md">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background text-primary shadow-sm ring-1 ring-border">
              {scanning ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
            </span>
            <div>
              <div className="text-lg font-semibold">Scan passport bio page</div>
              <div className="mt-1 text-sm text-muted-foreground">Upload a passport image or PDF up to 15 MB to extract the data and review the details before creating the record.</div>
            </div>
            <Input id="passport-scan-file" type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={event => { const nextFile = event.target.files?.[0] ?? null; void applyFile(nextFile); event.target.value = ''; }} />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2">
              <span className="truncate text-sm font-medium">{file.name}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void applyFile(null)}>Replace</Button>
            </div>
            {scanning && (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Reading MRZ</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</div>}

        {reportStatus && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            <span>{reportStatus}</span>
          </div>
        )}

        {imageUrl && <img src={imageUrl} alt="Rendered passport page" className="max-h-64 w-full rounded border bg-muted object-contain" />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="passport-first-name">First name</Label><Input id="passport-first-name" value={data.first_name ?? ''} onChange={event => update('first_name', event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="passport-last-name">Last name</Label><Input id="passport-last-name" value={data.last_name ?? ''} onChange={event => update('last_name', event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="passport-dob">Date of birth</Label><Input id="passport-dob" type="date" value={data.dob ?? ''} onChange={event => update('dob', event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="passport-number">Passport number</Label><Input id="passport-number" value={data.passport_number ?? ''} onChange={event => update('passport_number', event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="passport-origin">Country of origin (passport nationality)</Label><Input id="passport-origin" value={data.country_of_origin ?? ''} onChange={event => {
            update('country_of_origin', event.target.value);
            update('passport_nationality', event.target.value);
          }} /><p className="text-xs text-muted-foreground">Nationality is used for origin; MRZ does not contain a home city or birthplace.</p></div>
          <div className="space-y-2"><Label htmlFor="passport-issuer">Passport issuing country</Label><Input id="passport-issuer" value={data.passport_issuing_country ?? ''} onChange={event => update('passport_issuing_country', event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="passport-expiry">Passport expiry date</Label><Input id="passport-expiry" type="date" value={data.passport_expiry_date ?? ''} onChange={event => update('passport_expiry_date', event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="passport-document-type">Document type</Label><Input id="passport-document-type" value={data.passport_document_type ?? ''} onChange={event => update('passport_document_type', event.target.value)} /></div>
          <div className="space-y-2">
            <Label htmlFor="passport-gender">Gender *</Label>
            <Select value={data.gender} onValueChange={(value: 'male' | 'female') => update('gender', value)}>
              <SelectTrigger id="passport-gender"><SelectValue placeholder="Confirm from passport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
        <Button type="button" disabled={!canSubmit} onClick={() => onConfirm({
          data: { ...data, passport_image_url: imageUrl, passport_image_scan_report: screeningReport ?? { status: 'review', findings: ['Verify the entered details against the passport image.'], scanned_at: new Date().toISOString() } },
          imageUrl,
          screeningReport: screeningReport ?? { status: 'review', findings: ['Verify the entered details against the passport image.'], scanned_at: new Date().toISOString() },
        })}>Use details</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
};

export default PassportScanDialog;
