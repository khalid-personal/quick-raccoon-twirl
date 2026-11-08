import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, FileCheck2, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import type { CandidateDetail } from '@/lib/types';
import { candidatePackageDocuments, candidatePackageSummary, deploymentPackageHtml, packageMinistryBrand, type PackageDocument } from '@/lib/deployment-package';
import { downloadBlob } from '@/lib/document-files';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import DawmBrand from './DawmBrand';

export default function CandidateDeploymentPackage({ candidate }: { candidate: CandidateDetail }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PackageDocument | null>(null);
  const [downloading, setDownloading] = useState(false);
  const documents = useQuery({ queryKey: ['deploymentPackage', candidate.id, candidate.updated_at, candidate.documents, candidate.clearance, candidate.work_contract_record, candidate.passport_image_url], queryFn: () => candidatePackageDocuments(candidate), enabled: open });
  const summary = candidatePackageSummary(candidate);
  const filename = `deployment-package-${candidate.tracking_code.replace(/[^a-z0-9_-]/gi, '-')}`;
  const downloadBundle = () => {
    if (!documents.data) { toast.error('Load the document checklist before downloading.'); return; }
    downloadBlob(new Blob([deploymentPackageHtml(candidate, documents.data)], { type: 'text/html;charset=utf-8' }), `${filename}.html`);
    toast.success('Package ready. Open the downloaded HTML file to read the summary and save included files.');
  };
  const download = async () => {
    if (!documents.data || downloading) return;
    setDownloading(true);
    try {
      const { buildCandidateProfilePdf } = await import('@/lib/deployment-package-pdf');
      const result = await buildCandidateProfilePdf(candidate, documents.data);
      downloadBlob(new Blob([result.bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }), `${filename}.pdf`);
      toast.success(result.appendixRequired ? 'One-page overview ready. Download the HTML bundle for full long/non-Latin details and original files.' : 'One-page profile PDF ready. Original files are in the separate HTML bundle.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not generate the profile PDF. The HTML bundle is still available.'); }
    finally { setDownloading(false); }
  };
  return <>
    <Button variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal py-2" onClick={() => setOpen(true)}><FileCheck2 />View updates & deployment package</Button>
    <Dialog open={open && !preview} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl"><DialogHeader><DialogTitle>My deployment package</DialogTitle><DialogDescription>Download a one-page profile PDF and a separate HTML bundle with full safe details, available original files and a missing-items checklist. Long or non-Latin details may require the HTML appendix. Keep this personal information secure.</DialogDescription></DialogHeader>
      <div className="grid grid-cols-2 items-center gap-4 rounded-xl border p-4"><DawmBrand compact /><div className="min-w-0 text-sm"><p className="font-semibold">{packageMinistryBrand}</p><p className="text-muted-foreground">Logo not configured · no official endorsement</p></div></div>
      <div className="rounded-xl bg-primary/5 p-4"><h3 className="text-xl font-semibold">{summary.name}</h3><p>{summary.trackingCode} · Last updated: {summary.updatedAt}</p><p className="text-sm">Passport: {summary.passport} · {summary.nationality} · {summary.city}</p><p className="text-sm">{summary.occupation} · Languages: {summary.languages} · {summary.agencies}</p><p className="text-sm">Contract: {summary.contract} · Ministry: {summary.ministry}</p></div>
      <div className="space-y-1 rounded-xl border p-4 text-sm"><p>Date of birth: {summary.birthDate} · Gender: {summary.gender}</p><p>Email: {summary.email} · Phone: {summary.phone}</p><p>Passport expiry: {summary.passportExpiry}</p><p>Introduction: {summary.introduction}</p><p>Skills: {summary.skills}</p><p>Flight: {summary.flight}</p><p>Employer: {summary.employer}</p><p>Return date: {summary.returnDate}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{summary.stages.map(stage => <section key={stage.title} className="rounded-xl border p-4"><h4 className="text-lg font-semibold">{stage.title}</h4><p>{stage.status}</p>{stage.reference && <p className="text-sm">Reference: {stage.reference}</p>}<p className="text-sm text-muted-foreground">{stage.updatedAt || 'No update yet'}</p></section>)}</div>
      {documents.isLoading && <p role="status">Loading saved files…</p>}
      {documents.error && <div role="alert" className="rounded-xl border border-destructive p-4"><p>{documents.error.message}</p><Button variant="outline" onClick={() => void documents.refetch()}>Retry loading files</Button></div>}
      {documents.data?.map(doc => <article key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div className="flex items-center gap-3">{doc.url ? <FileCheck2 className="text-emerald-600" /> : <FileWarning className="text-amber-600" />}<div><p className="font-semibold">{doc.title}</p><p className="text-sm text-muted-foreground">{doc.stage} · {doc.url ? doc.local ? 'File included in HTML bundle (not profile PDF)' : 'Online file (not embedded)' : 'Original missing - ask your agency to upload it'}</p><p className="text-xs text-muted-foreground">{doc.updatedAt}</p></div></div>{doc.url && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPreview(doc)}><Eye />View</Button><Button size="sm" variant="outline" asChild><a href={doc.url} download={doc.local ? doc.filename : undefined} target={doc.local ? undefined : '_blank'} rel="noopener noreferrer"><Download />{doc.local ? 'Download' : 'Open original'}</a></Button></div>}</article>)}
      <p className="text-sm text-muted-foreground">This is a record snapshot, not an official clearance. Staff notes, chats, medical results and bank statements are excluded. Previously uploaded placeholders are marked missing.</p>
      <Button disabled={!documents.data || documents.isFetching || downloading} onClick={() => void download()}><Download />{downloading ? 'Generating PDF…' : 'Download one-page profile PDF'}</Button>
      <Button variant="outline" disabled={!documents.data || documents.isFetching} onClick={downloadBundle}><Download />Download full details & document bundle (HTML)</Button>
    </DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>View the available original file. Online links may require agency access. Close to return to your package.</DialogDescription></DialogHeader>{preview?.url && (preview.url.startsWith('data:image/') ? <img alt={preview.title} src={preview.url} className="max-h-[70vh] w-full object-contain" /> : <iframe title={preview.title} src={preview.url} sandbox="" referrerPolicy="no-referrer" className="h-[65vh] w-full rounded-lg border" />)}</DialogContent></Dialog>
  </>;
}
