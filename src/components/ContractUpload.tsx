import React, { useEffect, useRef, useState } from 'react';
import { FileSearch, Loader2, LockKeyhole, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { uploadDocument } from '@/lib/api/document-management';
import { CONTRACT_FIELD_LABELS, normalizeContractFields, scanContractFile, type ContractField } from '@/lib/contract-extraction';
import { blobDataUrl, getDocumentFile } from '@/lib/document-files';
import { safeDocumentUrl } from '@/lib/deployment-package';
import type { Candidate, Document, ExtractedDocumentFields } from '@/lib/types';
import { hasCompleteCandidateIntroduction } from '@/lib/candidate-introduction';
import DocumentScanInput, { type ScanSelection } from './DocumentScanInput';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface ContractUploadProps {
  candidate: Candidate;
  documents?: Document[];
  onChanged: () => void | Promise<void>;
}

const ContractUpload: React.FC<ContractUploadProps> = ({ candidate, documents = [], onChanged }) => {
  const { user, userRole, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [selection, setSelection] = useState<ScanSelection | null>(null);
  const [fields, setFields] = useState<ExtractedDocumentFields>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [scanError, setScanError] = useState('');
  const [scannedPages, setScannedPages] = useState(0);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [inputVersion, setInputVersion] = useState(0);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const selectedFile = useRef<File | null>(null);
  const id = React.useId();
  const savedContract = documents.find(document => document.id === candidate.work_contract_record?.document_id);
  useEffect(() => () => { selectedFile.current = null; }, []);

  const allowedRole = !!userRole && ['superadmin', 'admin', 'staff', 'local-agency', 'agency', 'foreign-agency', 'foreign-agency-staff'].includes(userRole);
  const sent = !!userRole && ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(userRole);
  const introductionReady = !sent || hasCompleteCandidateIntroduction(candidate);
  const receiveSelection = (next: ScanSelection | null) => {
    setSelection(next);
    setReviewed(false);
    if (next && selectedFile.current === next.file) return;
    selectedFile.current = next?.file ?? null;
    setFields({}); setWarnings([]); setScanError(''); setScannedPages(0); setReading(false);
    if (!next || next.report.status === 'blocked') return;
    const file = next.file;
    setReading(true);
    void scanContractFile(file).then(result => {
      if (selectedFile.current !== file) return;
      setFields(result.fields); setWarnings(result.warnings); setScannedPages(result.scannedPages);
    }).catch(error => {
      if (selectedFile.current === file) setScanError(error instanceof Error ? error.message : 'Could not read the contract.');
    }).finally(() => { if (selectedFile.current === file) setReading(false); });
  };

  const viewOriginal = async () => {
    try {
      const document = documents.find(item => item.id === candidate.work_contract_record?.document_id);
      const file = selection?.file ?? (document ? await getDocumentFile(document.id) : undefined);
      const url = file ? await blobDataUrl(file) : safeDocumentUrl(candidate.work_contract_record?.url);
      if (!url) throw new Error('The original file is unavailable on this browser. Upload the original contract here to scan it.');
      setPreview({ url, name: selection?.file.name ?? document?.file_name ?? 'Original contract', type: selection?.file.type ?? document?.file_type ?? 'application/pdf' });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not open the contract.'); }
  };

  const save = async () => {
    if (!user?.id || !user.email || !userRole || !selection?.ready || !reviewed || reading) {
      toast.error('Sign in, finish file checks and confirm the fields against the original contract.');
      return;
    }
    setSaving(true);
    try {
      await uploadDocument(candidate.id, 4, selection.file, selection.report, {
        fields: normalizeContractFields(fields), scannedPages, confirmed: reviewed,
        actor: { id: user.id, email: user.email, role: userRole, localAgencyId: userLocalAgencyId, foreignAgencyId: userForeignAgencyId },
      });
      toast.success('Contract evidence saved on this browser. Reviewed employer details updated; ministry identity and visa clearance unchanged.');
      selectedFile.current = null; setSelection(null); setFields({}); setReviewed(false); setInputVersion(value => value + 1);
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save the contract.'); }
    finally { setSaving(false); }
  };

  return <section className="min-w-0 space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5" aria-label="Contract scan and review">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-semibold"><FileSearch className="h-5 w-5 text-primary" />Contract intelligence</h3><p className="mt-1 text-xs text-muted-foreground">Original file → scan → review → employer contacts</p></div>
      {(candidate.work_contract_record?.document_id || candidate.work_contract_record?.url || selection?.file) && <Button type="button" variant="outline" onClick={() => void viewOriginal()}>View original contract</Button>}
    </div>
    <p className="text-sm text-muted-foreground">Upload the agency-submitted employment contract. Only labeled employer and contract details are proposed; candidate and emergency contacts remain ministry-owned. Files are stored on this browser; secure cross-agency file delivery is not connected.</p>
    {!introductionReady && <p role="status" className="text-sm text-amber-700">Ministry introduction details are incomplete. You can preview a contract, but submission requires the candidate’s gender, introduction, skills, languages and video.</p>}
    {savedContract?.extracted && <div className="space-y-3 rounded-xl border bg-background/60 p-4">
      <p className="text-xs font-semibold text-primary">Reviewed contract · {savedContract.extraction_review?.reviewed_at.slice(0, 10)} · {candidate.work_contract_record?.status}</p>
      <dl className="grid gap-3 sm:grid-cols-2">{(Object.keys(CONTRACT_FIELD_LABELS) as ContractField[]).filter(field => !!savedContract.extracted?.[field]).map(field => <div key={field} className="min-w-0"><dt className="text-xs text-muted-foreground">{CONTRACT_FIELD_LABELS[field]}</dt><dd className="break-words text-sm">{savedContract.extracted?.[field]}</dd></div>)}</dl>
      <p className="text-xs text-muted-foreground">Saved with the original document. This is reviewed agency evidence, not a ministry verification.</p>
    </div>}
    {allowedRole ? <>
      <DocumentScanInput key={inputVersion} id={`${id}-file`} accept="application/pdf,image/png,image/jpeg,image/webp" existingDocuments={documents} disabled={saving} onChange={receiveSelection} />
      {reading && <p role="status" className="flex items-center gap-2 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin" />Reading contract pages and labeled employer fields...</p>}
      {selection && selection.report.status !== 'blocked' && !reading && <>
        {scanError && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Automatic extraction failed: {scanError} Open the original and enter its fields manually, or choose a clearer file.</p>}
        {!!warnings.length && <ul className="space-y-1 rounded-xl border border-primary/15 bg-background/60 p-3 text-xs text-muted-foreground">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {(Object.keys(CONTRACT_FIELD_LABELS) as ContractField[]).map(field => <div key={field} className="min-w-0 space-y-1">
            <Label htmlFor={`${id}-${field}`} className="text-xs">{CONTRACT_FIELD_LABELS[field]}</Label>
            <Input id={`${id}-${field}`} value={fields[field] ?? ''} placeholder="Not detected — check original" maxLength={500} disabled={saving} onChange={event => { setFields(current => ({ ...current, [field]: event.target.value })); setReviewed(false); }} />
          </div>)}
        </div>
        <div className="flex items-start gap-2 rounded-xl border bg-background/60 p-3">
          <Checkbox id={`${id}-review`} checked={reviewed} disabled={saving || !selection.ready} onCheckedChange={value => setReviewed(value === true)} />
          <Label htmlFor={`${id}-review`} className="text-sm leading-relaxed">I compared these fields with the original contract for {candidate.first_name} {candidate.last_name}. Missing or uncertain values are empty; this is evidence, not official approval.</Label>
        </div>
        {candidate.employer && <p className="text-xs text-muted-foreground">Saving a detected employer may replace the employer contact card. Missing values do not overwrite contacts for the same employer; a different employer never inherits the old employer’s contacts.</p>}
        <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={saving || reading || !selection.ready || !reviewed || !introductionReady} onClick={() => void save()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{sent ? 'Submit reviewed contract' : 'Save received contract'}</Button>
      </>}
    </> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />Only authorized agency or staff accounts can submit contract evidence.</p>}
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}>
      <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>Compare the original with the proposed fields. No source identity or clearance is changed.</DialogDescription></DialogHeader>
        {preview && (preview.type.startsWith('image/') ? <img src={preview.url} alt="Original contract" className="max-h-[65dvh] w-full object-contain" /> : <iframe src={preview.url} title="Original contract" className="h-[65dvh] w-full rounded-xl border" />)}
      </DialogContent>
    </Dialog>
  </section>;
};
export default ContractUpload;
