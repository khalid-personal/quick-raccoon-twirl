import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Document } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      await api.uploadDocument(candidateId, stageId, selectedFile);
      toast.success(`Document "${selectedFile.name}" uploaded successfully.`);
      setSelectedFile(null);
      // Clear the file input manually
      const input = document.getElementById(`file-input-${stageId}`) as HTMLInputElement;
      if (input) input.value = '';
      
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      <h5 className="text-sm font-semibold text-muted-foreground">Stage Documents ({existingDocuments.length})</h5>
      
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
      <div className="flex gap-2 items-center">
        <Input 
          id={`file-input-${stageId}`} 
          type="file" 
          onChange={handleFileChange} 
          disabled={isUploading}
          className="h-9 text-sm"
        />
        <Button 
          onClick={handleUpload} 
          disabled={isUploading || !selectedFile}
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