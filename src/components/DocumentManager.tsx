import React, { useState } from 'react';
import { CandidateDetail, ALL_STAGES, Document } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DocumentManagerProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ candidateDetail, refetch }) => {
  const [selectedStageId, setSelectedStageId] = useState<string>('');
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
    if (!selectedStageId || !selectedFile) {
      toast.error("Please select a stage and a file.");
      return;
    }

    setIsUploading(true);
    try {
      await api.uploadDocument(candidateDetail.id, parseInt(selectedStageId), selectedFile);
      toast.success(`Document "${selectedFile.name}" uploaded successfully.`);
      setSelectedFile(null);
      setSelectedStageId('');
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploading(false);
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
      <Card>
        <CardHeader>
          <CardTitle>Upload New Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="stage-select">Associate with Stage</Label>
              <Select
                value={selectedStageId}
                onValueChange={setSelectedStageId}
                disabled={isUploading}
              >
                <SelectTrigger id="stage-select">
                  <SelectValue placeholder="Select Stage" />
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
            
            <div className="space-y-2">
              <Label htmlFor="file-input">Select File</Label>
              <Input 
                id="file-input" 
                type="file" 
                onChange={handleFileChange} 
                disabled={isUploading}
              />
            </div>
            
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !selectedStageId || !selectedFile}
              className="w-full md:w-auto"
            >
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Documents ({candidateDetail.documents.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(documentsByStage).length === 0 ? (
            <p className="text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            Object.entries(documentsByStage).map(([stageTitle, docs]) => (
              <div key={stageTitle} className="border p-4 rounded-lg">
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
                        <a 
                          href={doc.public_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View (Mock Link)
                        </a>
                        {/* Mock Delete Button */}
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-100" disabled>
                          <Trash2 className="h-3 w-3" />
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
    </div>
  );
};

export default DocumentManager;