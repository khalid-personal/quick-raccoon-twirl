import React, { useState } from 'react';
import { AlertTriangle, FileCheck2, FileSearch, ShieldAlert, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { scanDocumentFile } from '@/lib/document-screening';
import { detectDocumentStageFromFile } from '@/lib/document-stage-detection';
import { ALL_STAGES, type Document, type UploadScanReport } from '@/lib/types';

export interface ScanSelection {
  file: File;
  report: UploadScanReport;
  ready: boolean;
  detectedStageId?: number;
  detectionSource?: 'file name' | 'document text';
  detectionError?: string;
}

interface DocumentScanInputProps {
  id: string;
  accept?: string;
  disabled?: boolean;
  detectStage?: boolean;
  existingDocuments?: Document[];
  onChange: (selection: ScanSelection | null) => void;
}

const statusStyle = {
  clear: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  review: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  blocked: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
} as const;

const DocumentScanInput: React.FC<DocumentScanInputProps> = ({ id, accept, disabled = false, detectStage = false, existingDocuments = [], onChange }) => {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<UploadScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [stageDetection, setStageDetection] = useState<Omit<ScanSelection, 'file' | 'report' | 'ready'>>({});

  const scan = async (selected?: File) => {
    setFile(selected ?? null);
    setReport(null);
    setAcknowledged(false);
    setStageDetection({});
    if (!selected) {
      onChange(null);
      return;
    }

    setScanning(true);
    try {
      const result = await scanDocumentFile(selected, existingDocuments);
      const ready = result.status === 'clear';
      let detection: Omit<ScanSelection, 'file' | 'report' | 'ready'> = {};
      if (detectStage && result.status !== 'blocked') {
        try {
          detection = await detectDocumentStageFromFile(selected);
        } catch (error) {
          detection = { detectionError: error instanceof Error ? error.message : 'Could not read the document contents.' };
        }
      }
      setStageDetection(detection);
      setReport(result);
      setAcknowledged(ready);
      onChange({ file: selected, report: result, ready, ...detection });
    } catch (error) {
      const result: UploadScanReport = {
        status: 'blocked',
        findings: [`The file could not be screened: ${error instanceof Error ? error.message : 'unknown error'}`],
        scanned_at: new Date().toISOString(),
      };
      setReport(result);
      onChange({ file: selected, report: result, ready: false });
    } finally {
      setScanning(false);
    }
  };

  const acknowledgeReview = (checked: boolean | 'indeterminate') => {
    const confirmed = checked === true;
    setAcknowledged(confirmed);
    if (file && report) onChange({ file, report, ready: report.status === 'clear' || (report.status === 'review' && confirmed), ...stageDetection });
  };

  const receiveDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!disabled && !scanning) void scan(event.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="sr-only">Choose document</Label>
      <label
        htmlFor={id}
        onDragOver={event => event.preventDefault()}
        onDrop={receiveDrop}
        className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-4 transition-colors ${disabled || scanning ? 'cursor-wait opacity-60' : 'hover:border-primary hover:bg-muted/40'}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {scanning ? <FileSearch className="h-5 w-5 animate-pulse text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{file?.name ?? 'Choose a file or drop it here'}</span>
          <span className="mt-1 block text-xs text-muted-foreground">We check the file format, size and signs of unsafe content before upload.</span>
        </span>
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={disabled || scanning}
          className="sr-only"
          onChange={event => { void scan(event.target.files?.[0]); event.target.value = ''; }}
        />
      </label>

      {report && (
        <div className={`space-y-2 rounded-md border p-3 text-sm ${statusStyle[report.status]}`} role="status" aria-live="polite">
          <div className="flex items-center gap-2 font-medium">
            {report.status === 'clear' ? <FileCheck2 className="h-4 w-4" /> : report.status === 'review' ? <AlertTriangle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            <span>{report.status === 'clear' ? 'File checks passed' : report.status === 'review' ? 'This file needs a closer look' : 'Upload blocked'}</span>
            <Badge variant="outline" className="ml-auto">{report.status === 'clear' ? 'Ready to upload' : report.status === 'review' ? 'Needs review' : 'Blocked'}</Badge>
          </div>
          {report.findings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs">{report.findings.map(finding => <li key={finding}>{finding}</li>)}</ul>}
          {report.status === 'review' && (
            <div className="flex items-start gap-2 border-t border-current/15 pt-2">
              <Checkbox id={`${id}-review`} checked={acknowledged} onCheckedChange={acknowledgeReview} disabled={disabled} />
              <Label htmlFor={`${id}-review`} className="text-xs leading-relaxed">I have read the warnings and want to submit this file for someone to review.</Label>
            </div>
          )}
          {detectStage && stageDetection.detectedStageId !== undefined && (
            <p className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary" role="status">
              <FileCheck2 className="h-4 w-4 shrink-0" />
              <span>Document matched to <strong>{ALL_STAGES.find(stage => stage.id === stageDetection.detectedStageId)?.title ?? 'a workflow stage'}</strong> using its {stageDetection.detectionSource}.</span>
            </p>
          )}
          {detectStage && stageDetection.detectionError && <p className="text-xs text-amber-700 dark:text-amber-300" role="status">Automatic stage matching failed: {stageDetection.detectionError} Choose a stage manually or use the stage you opened.</p>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">File checks can find possible problems. Passing them does not prove the document is genuine.</p>
    </div>
  );
};

export default DocumentScanInput;
