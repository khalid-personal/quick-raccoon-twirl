import React, { useState } from 'react';
import { api } from '@/lib/api';
import { ALL_STAGES, Document } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import DocumentScanInput, { type ScanSelection } from '@/components/DocumentScanInput';

interface StageDocumentUploaderProps {
  candidateId: string;
  stageId: number;
  existingDocuments: Document[];
  refetch: () => void;
}

const StageDocumentUploader: React.FC<StageDocumentUploaderProps> = ({
  candidateId,
  stageId,
  existingDocuments,
  refetch,
}) => {
  const [scanSelection, setScanSelection] = useState<ScanSelection | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!scanSelection?.ready) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      const targetStageId = scanSelection.detectedStageId ?? stageId;
      await api.uploadDocument(candidateId, targetStageId, scanSelection.file, scanSelection.report);
      toast.success(`Document "${scanSelection.file.name}" uploaded successfully.`);
      setScanSelection(null);
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };
  const detectedStageId = scanSelection?.detectedStageId;
  const detectedStage = ALL_STAGES.find(stage => stage.id === detectedStageId);
  const destinationStage = detectedStage ?? ALL_STAGES.find(stage => stage.id === stageId);

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      <h5 className="text-sm font-semibold text-muted-foreground">Stage Documents ({existingDocuments.length})</h5>
      {scanSelection?.ready && destinationStage && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground" role="status">
          {detectedStage
            ? <>Detected as <span className="font-semibold text-foreground">{detectedStage.title}</span> from the {scanSelection?.detectionSource ?? 'document'}; it will be filed under that stage.</>
            : <>No document type detected; it will be filed under <span className="font-semibold text-foreground">{destinationStage.title}</span>, the stage currently open.</>}
        </p>
      )}
      
      {/* Existing Documents List */}
      {existingDocuments.length > 0 && (
        <div className="space-y-1">
          {existingDocuments.map(doc => (
            <a 
              key={doc.id} 
              href={doc.public_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{doc.file_name}</span>
            </a>
          ))}
        </div>
      )}

      {/* Upload Form */}
      <div className="space-y-2">
        <DocumentScanInput id={`file-input-${stageId}`} detectStage existingDocuments={existingDocuments} disabled={isUploading} onChange={setScanSelection} />
        <Button 
          onClick={handleUpload} 
          disabled={isUploading || !scanSelection?.ready}
          size="sm"
          className="flex-shrink-0"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default StageDocumentUploader;