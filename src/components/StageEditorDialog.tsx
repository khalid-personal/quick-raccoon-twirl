import React, { useState, useEffect } from 'react';
import { CandidateDetail, CandidateStage, Stage, StageStatus, ALL_STAGES } from '@/lib/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import StageDocumentUploader from './StageDocumentUploader';
import { getStatusColor, cn } from '@/lib/utils';

interface StageEditorDialogProps {
  candidateDetail: CandidateDetail;
  candidateStage: CandidateStage;
  stage: Stage;
  refetch: () => void;
  onClose: () => void;
}

const statusOptions: StageStatus[] = ['Pending', 'In Progress', 'Passed', 'Failed', 'Issued', 'Completed'];

const StageEditorDialog: React.FC<StageEditorDialogProps> = ({
  candidateDetail,
  candidateStage,
  stage,
  refetch,
  onClose,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StageStatus>(candidateStage.status);
  const [notes, setNotes] = useState(candidateStage.notes || '');
  const [date, setDate] = useState(candidateStage.date ? candidateStage.date.split('T')[0] : '');
  const [referenceId, setReferenceId] = useState(candidateStage.reference_id || '');

  // Check if any field has been modified
  const isModified = status !== candidateStage.status ||
                     notes !== (candidateStage.notes || '') ||
                     date !== (candidateStage.date ? candidateStage.date.split('T')[0] : '') ||
                     referenceId !== (candidateStage.reference_id || '');

  // Dependency check: Labor ID requires CoC Training to be Passed
  const cocTrainingStage = candidateDetail.stages.find(cs => 
    ALL_STAGES.find(s => s.id === cs.stage_id)?.slug === 'coc_training'
  );
  const isCocTrainingPassed = cocTrainingStage?.status === 'Passed' || cocTrainingStage?.status === 'Completed' || cocTrainingStage?.status === 'Issued';
  const isLaborIdStage = stage.slug === 'labor_id';

  let isDisabled = isSaving;
  let dependencyMessage: string | null = null;

  if (isLaborIdStage && !isCocTrainingPassed) {
      isDisabled = true;
      dependencyMessage = "Requires CoC Training to be Passed before updating Labor ID status.";
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateStageStatus(
        candidateDetail.id,
        stage.id,
        status,
        notes,
        date || undefined,
        referenceId || undefined
      );
      toast.success(`${stage.title} status updated.`);
      refetch();
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const documentsForStage = candidateDetail.documents.filter(doc => doc.stage_id === stage.id);

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle className={cn("text-lg font-bold", getStatusColor(candidateStage.status))}>
          {stage.title}
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        {dependencyMessage && (
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-sm text-yellow-800 dark:text-yellow-200 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            {dependencyMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(value: StageStatus) => setStatus(value)}
              disabled={isDisabled}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(optStatus => (
                  <SelectItem key={optStatus} value={optStatus}>
                    {optStatus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isDisabled}
            />
          </div>
        </div>
        
        {/* Conditional Input for Labor ID */}
        {isLaborIdStage ? (
          <div className="space-y-2">
            <Label htmlFor="reference_id">Labor ID Number</Label>
            <Input
              id="reference_id"
              type="text" 
              placeholder="Enter Labor ID"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              disabled={isDisabled}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add internal notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isDisabled}
            />
          </div>
        )}
        
        <StageDocumentUploader
          candidateId={candidateDetail.id}
          stageId={stage.id}
          existingDocuments={documentsForStage}
          refetch={refetch}
        />
      </div>

      <DialogFooter>
        <Button 
          onClick={handleSave} 
          disabled={isDisabled || !isModified}
        >
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default StageEditorDialog;