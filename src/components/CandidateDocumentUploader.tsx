import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Document, PublicTrackingData, ALL_STAGES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface CandidateDocumentUploaderProps {
  candidateId: string;
  timeline: PublicTrackingData['timeline'];
  existingDocuments: Document[];
  refetch: () => void;
}

const CandidateDocumentUploader: React.FC<CandidateDocumentUploaderProps> = ({
  candidateId,
  timeline,
  existingDocuments,
  refetch,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedStageId) {
      toast.error("Please select a stage and a file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      await api.uploadDocument(candidateId, parseInt(selectedStageId), selectedFile);
      toast.success(`Document "${selectedFile.name}" uploaded successfully.`);
      setSelectedFile(null);
      setSelectedStageId('');
      
      // Clear the file input manually
      const input = document.getElementById(`candidate-file-input`) as HTMLInputElement;
      if (input) input.value = '';
      
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Filter stages to only show those that are currently pending or in progress
  const availableStages = timeline
    .filter(item => item.status === 'Pending' || item.status === 'In Progress')
    .map(item => ALL_STAGES.find(s => s.title === item.title))
    .filter((stage): stage is typeof ALL_STAGES[number] => !!stage);

  // Group existing documents by stage
  const documentsByStage = existingDocuments.reduce((acc, doc) => {
    const stage = ALL_STAGES.find(s => s.id === doc.stage_id);
    const stageTitle = stage ? stage.title : 'General Documents';
    if (!acc[stageTitle]) {
      acc[stageTitle] = [];
    }
    acc[stageTitle].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <FileText className="h-5 w-5 mr-2 text-primary" />
          My Documents
        </CardTitle>
        <p className="text-sm text-muted-foreground">Upload required documents for your current stages.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Upload Form */}
        <div className="space-y-4 border p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold">Upload New Document</h4>
            {availableStages.length === 0 && (
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-sm text-yellow-800 dark:text-yellow-200 flex items-center rounded-md">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                    No stages are currently open for document submission.
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="stage-select">Associate with Stage</Label>
                    <Select
                        value={selectedStageId}
                        onValueChange={setSelectedStageId}
                        disabled={isUploading || availableStages.length === 0}
                    >
                        <SelectTrigger id="stage-select">
                            <SelectValue placeholder="Select Stage" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableStages.map(stage => (
                                <SelectItem key={stage.id} value={String(stage.id)}>
                                    {stage.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="candidate-file-input">Select File</Label>
                    <Input 
                        id="candidate-file-input" 
                        type="file" 
                        onChange={handleFileChange} 
                        disabled={isUploading || availableStages.length === 0}
                    />
                </div>
                
                <Button 
                    onClick={handleUpload} 
                    disabled={isUploading || !selectedStageId || !selectedFile || availableStages.length === 0}
                    className="w-full md:w-auto"
                >
                    {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload
                </Button>
            </div>
        </div>
        
        {/* Existing Documents List */}
        <div className="space-y-4">
            <h4 className="font-semibold">Uploaded Documents ({existingDocuments.length})</h4>
            {Object.entries(documentsByStage).length === 0 ? (
                <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
            ) : (
                <div className="space-y-3">
                    {Object.entries(documentsByStage).map(([stageTitle, docs]) => (
                        <div key={stageTitle} className="border p-3 rounded-lg">
                            <h5 className="font-medium text-sm mb-2 text-primary">{stageTitle}</h5>
                            <div className="space-y-1">
                                {docs.map(doc => (
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
                        </div>
                    ))}
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CandidateDocumentUploader;