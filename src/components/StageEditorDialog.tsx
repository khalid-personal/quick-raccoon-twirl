import React, { useState, useEffect } from 'react';
import { CandidateDetail, CandidateStage, Stage, StageStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import StageDocumentUploader from './StageDocumentUploader';
import { getStatusColor, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Added Badge import
import { usePortalData } from '@/hooks/use-portal-data';

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
  const prefix = React.useId();
  const fieldId = (name: string) => `${prefix}-${name}`;
  const { paymentStatuses, stageFees } = usePortalData();
  const stageFee = stageFees[stage.id] ?? stage.fee_amount ?? 0;
  const stageFeePaid = paymentStatuses.some(payment =>
    payment.candidateId === candidateDetail.id && payment.stageId === stage.id && payment.isPaid,
  );
  const completionLocked = stageFee > 0 && !stageFeePaid;

  // Check if any field has been modified
  const isModified = status !== candidateStage.status ||
                     notes !== (candidateStage.notes || '') ||
                     date !== (candidateStage.date ? candidateStage.date.split('T')[0] : '') ||
                     referenceId !== (candidateStage.reference_id || '');

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
    <DialogContent className="sm:max-w-[700px]">
      <DialogHeader className="border-b pb-4">
        <div className="flex justify-between items-start">
          <DialogTitle className="text-2xl font-extrabold">
            {stage.title} · {candidateDetail.tracking_code}
          </DialogTitle>
          <Badge className={cn("text-sm font-semibold px-3 py-1", getStatusColor(candidateStage.status))}>
            Current Status: {candidateStage.status}
          </Badge>
        </div>
        <DialogDescription>Review {stage.title.toLowerCase()}, attach its evidence, and update progress. Required stage fees must be paid before completion.</DialogDescription>
      </DialogHeader>
      
      <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
        {completionLocked && <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><span className="font-semibold">{stageFee.toLocaleString()} ETB stage fee is unpaid.</span> This stage cannot be marked Passed, Issued, or Completed until payment is recorded. You can still update its progress and documents.</p>
        </div>}
        {/* Section 1: Status and Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2 text-gray-700 dark:text-gray-300">Update Status & Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Select */}
            <div className="space-y-2">
              <Label htmlFor={fieldId('status')}>New Status</Label>
              <Select
                value={status}
                onValueChange={(value: StageStatus) => setStatus(value)}
                disabled={isSaving}
              >
                <SelectTrigger id={fieldId('status')}>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(optStatus => (
                    <SelectItem key={optStatus} value={optStatus} disabled={completionLocked && ['Passed', 'Issued', 'Completed'].includes(optStatus) && optStatus !== candidateStage.status}>
                      {optStatus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Input */}
            <div className="space-y-2">
              <Label htmlFor={fieldId('date')}>Date of Completion/Update</Label>
              <Input
                id={fieldId('date')}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          
          {/* Notes/Reference ID */}
          <div className="space-y-2 pt-2">
            <Label htmlFor={fieldId('reference_id')}>Stage Reference (Optional)</Label>
            <Input
              id={fieldId('reference_id')}
              type="text"
              placeholder="Enter a stage reference"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor={fieldId('notes')}>Internal Notes</Label>
            <Textarea
              id={fieldId('notes')}
              placeholder="Add internal notes about this stage update..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              rows={4}
            />
          </div>
        </div>
        
        {/* Section 2: Documents */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold pb-2 text-gray-700 dark:text-gray-300">Stage Documents</h3>
          <StageDocumentUploader
            candidateId={candidateDetail.id}
            stageId={stage.id}
            existingDocuments={documentsForStage}
            refetch={refetch}
          />
        </div>
      </div>

      <DialogFooter className="pt-4 border-t">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !isModified}
        >
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default StageEditorDialog;