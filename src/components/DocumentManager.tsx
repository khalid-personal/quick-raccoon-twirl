import React, { useState } from 'react';
import { CandidateDetail, ALL_STAGES, Document } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import DocumentScanInput, { type ScanSelection } from '@/components/DocumentScanInput';
import { getDocumentFile, blobDataUrl } from '@/lib/document-files';
import { safeDocumentUrl } from '@/lib/deployment-package';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface DocumentManagerProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ candidateDetail, refetch }) => {
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [scanSelection, setScanSelection] = useState<ScanSelection | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ document: Document; url: string } | null>(null);
  const viewDocument = async (document: Document) => {
    try {
      const file = await getDocumentFile(document.id);
      const url = file ? await blobDataUrl(file) : safeDocumentUrl(document.public_url);
      if (!url) throw new Error('The original file is missing. Please upload it again; the old placeholder was not a saved document.');
      setPreview({ document, url });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not open the document.'); }
  };

  const handleUpload = async () => {
    if ((!selectedStageId && !detectedStage) || !scanSelection?.ready) {
      toast.error("Please select a stage and a file.");
      return;
    }

    setIsUploading(true);
    try {
      const detectedStageId = scanSelection.detectedStageId;
      const targetStageId = detectedStageId ?? parseInt(selectedStageId);
      await api.uploadDocument(candidateDetail.id, targetStageId, scanSelection.file, scanSelection.report);
      toast.success(`Document "${scanSelection.file.name}" uploaded successfully.`);
      setScanSelection(null);
      setSelectedStageId('');
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };
  const detectedStageId = scanSelection?.detectedStageId;
  const detectedStage = ALL_STAGES.find(stage => stage.id === detectedStageId);
  
  const handleDelete = async (docId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete the document "${fileName}"? This action cannot be undone.`)) {
        return;
    }
    
    setDeletingDocId(docId);
    try {
        await api.deleteDocument(docId);
        toast.success(`Document "${fileName}" deleted successfully.`);
        refetch();
    } catch (error) {
        toast.error((error as Error).message);
    } finally {
        setDeletingDocId(null);
    }
  };
  
  // Group documents by stage for display
  const documentsByStage = candidateDetail.documents.reduce((acc, doc) => {
    const stage = ALL_STAGES.find(s => s.id === doc.stage_id);
    const stageTitle = stage ? stage.title : 'General Documents';
    if (!acc[stageTitle]) {
      acc[stageTitle] = [];
    }
    acc[stageTitle].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-cyan-500/25">
        <CandidateCheckpoint eyebrow="Candidate evidence checkpoint" title="Upload New Document" description="Screen the original file, confirm its stage and add it to the candidate's evidence record." icon={Upload} />
        <CardContent className="space-y-4 p-5 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="stage-select">Associate with Stage</Label>
              <Select
                value={detectedStage ? String(detectedStage.id) : selectedStageId}
                onValueChange={setSelectedStageId}
                disabled={isUploading || !!detectedStage}
              >
                <SelectTrigger id="stage-select">
                  <SelectValue placeholder={detectedStage ? detectedStage.title : 'Select Stage'} />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAGES.map(stage => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      {stage.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label>Screen and select file</Label>
              <DocumentScanInput id="file-input" detectStage existingDocuments={candidateDetail.documents} disabled={isUploading} onChange={setScanSelection} />
            </div>
            {scanSelection?.ready && detectedStage && <p className="text-sm text-primary md:col-span-3" role="status">Detected <span className="font-semibold">{detectedStage.title}</span> from the {scanSelection.detectionSource ?? 'document'}. This document will be added to that stage.</p>}
            
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || (!selectedStageId && !detectedStage) || !scanSelection?.ready}
              className="h-12 w-full rounded-xl px-5 md:w-auto"
            >
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-cyan-500/25">
        <CandidateCheckpoint eyebrow="Candidate document checkpoint" title={`Existing Documents (${candidateDetail.documents.length})`} description="Review or download the available originals, grouped by stage. A missing original still requires a new upload." icon={FileText} metric={candidateDetail.documents.length} metricLabel="Saved documents" />
        <CardContent className="space-y-6 p-5 sm:p-7">
          {Object.entries(documentsByStage).length === 0 ? (
            <p className="text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            Object.entries(documentsByStage).map(([stageTitle, docs]) => (
              <div key={stageTitle} className="rounded-2xl border bg-background/70 p-5">
                <h4 className="font-semibold mb-3 text-lg">{stageTitle}</h4>
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">Uploaded: {format(new Date(doc.uploaded_at), 'PPP')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline" onClick={() => void viewDocument(doc)}>View / download</Button>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20" 
                          onClick={() => handleDelete(doc.id, doc.file_name)}
                          disabled={deletingDocId === doc.id}
                        >
                          {deletingDocId === doc.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>{preview?.document.file_name}</DialogTitle><DialogDescription>Original uploaded file. Saved files are browser-local; use the deployment package to keep an offline copy.</DialogDescription></DialogHeader>{preview && <>{preview.url.startsWith('data:image/') ? <img src={preview.url} alt={preview.document.file_name} className="max-h-[65vh] w-full object-contain" /> : <iframe title={preview.document.file_name} src={preview.url} sandbox="" referrerPolicy="no-referrer" className="h-[65vh] w-full rounded-lg border" />}<Button asChild><a href={preview.url} download={preview.document.file_name}>Download original</a></Button></>}</DialogContent></Dialog>
    </div>
  );
};

export default DocumentManager;