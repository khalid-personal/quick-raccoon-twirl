import React, { useState } from 'react';
import { CandidateDetail, ALL_STAGES, StageStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { getStatusColor, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import StageDocumentUploader from './StageDocumentUploader'; // Import new component

interface TimelineEditorProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const statusOptions: StageStatus[] = ['Pending', 'In Progress', 'Passed', 'Failed', 'Issued', 'Completed'];

const TimelineEditor: React.FC<TimelineEditorProps> = ({ candidateDetail, refetch }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [stageUpdates, setStageUpdates] = useState<{
    [stageId: number]: { status: StageStatus; notes: string; date: string; reference_id: string };
  }>({});

  React.useEffect(() => {
    // Initialize state from candidate detail
    const initialUpdates: { [stageId: number]: { status: StageStatus; notes: string; date: string; reference_id: string } } = {};
    candidateDetail.stages.forEach(cs => {
      initialUpdates[cs.stage_id] = {
        status: cs.status,
        notes: cs.notes || '',
        date: cs.date ? cs.date.split('T')[0] : '', // Format date for input type="date"
        reference_id: cs.reference_id || '', // Initialize new field
      };
    });
    setStageUpdates(initialUpdates);
  }, [candidateDetail]);

  const handleUpdateChange = (stageId: number, field: 'status' | 'notes' | 'date' | 'reference_id', value: string) => {
    setStageUpdates(prev => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (stageId: number) => {
    const update = stageUpdates[stageId];
    if (!update) return;

    setIsSaving(true);
    try {
      await api.updateStageStatus(
        candidateDetail.id,
        stageId,
        update.status,
        update.notes,
        update.date || undefined,
        update.reference_id || undefined // Pass reference ID
      );
      toast.success(`${ALL_STAGES.find(s => s.id === stageId)?.title} status updated.`);
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Dependency check: Labor ID requires CoC Training to be Passed
  const cocTrainingStage = candidateDetail.stages.find(cs => 
    ALL_STAGES.find(s => s.id === cs.stage_id)?.slug === 'coc_training'
  );
  const isCocTrainingPassed = cocTrainingStage?.status === 'Passed' || cocTrainingStage?.status === 'Completed' || cocTrainingStage?.status === 'Issued';
  const laborIdStageId = ALL_STAGES.find(s => s.slug === 'labor_id')?.id;


  return (
    <div className="space-y-4">
      {candidateDetail.stages.map((cs) => {
        const stage = ALL_STAGES.find(s => s.id === cs.stage_id)!;
        const currentUpdate = stageUpdates[stage.id] || { 
            status: cs.status, 
            notes: cs.notes || '', 
            date: cs.date ? cs.date.split('T')[0] : '',
            reference_id: cs.reference_id || ''
        };
        
        const isLaborIdStage = stage.id === laborIdStageId;
        
        const isModified = currentUpdate.status !== cs.status || 
                           currentUpdate.notes !== (cs.notes || '') || 
                           currentUpdate.date !== (cs.date ? cs.date.split('T')[0] : '') ||
                           currentUpdate.reference_id !== (cs.reference_id || '');
        
        let isDisabled = isSaving;
        let dependencyMessage: string | null = null;

        if (isLaborIdStage && !isCocTrainingPassed) {
            isDisabled = true;
            dependencyMessage = "Requires CoC Training to be Passed before updating Labor ID status.";
        }
        
        const documentsForStage = candidateDetail.documents.filter(doc => doc.stage_id === stage.id);

        return (
          <Card key={stage.id}>
            <CardHeader className={cn("flex flex-row items-center justify-between p-4", getStatusColor(cs.status))}>
              <CardTitle className="text-white text-lg">{stage.title}</CardTitle>
              <Badge variant="secondary" className="text-sm font-semibold">
                Current: {cs.status}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {dependencyMessage && (
                <div className="md:col-span-4 p-2 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  {dependencyMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`status-${stage.id}`}>Status</Label>
                <Select
                  value={currentUpdate.status}
                  onValueChange={(value: StageStatus) => handleUpdateChange(stage.id, 'status', value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id={`status-${stage.id}`}>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(status => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`date-${stage.id}`}>Date</Label>
                <Input
                  id={`date-${stage.id}`}
                  type="date"
                  value={currentUpdate.date}
                  onChange={(e) => handleUpdateChange(stage.id, 'date', e.target.value)}
                  disabled={isDisabled}
                />
              </div>
              
              {/* Conditional Input for Labor ID */}
              {isLaborIdStage ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`reference_id-${stage.id}`}>Labor ID Number</Label>
                  <Input
                    id={`reference_id-${stage.id}`}
                    type="text" 
                    placeholder="Enter Labor ID"
                    value={currentUpdate.reference_id}
                    onChange={(e) => handleUpdateChange(stage.id, 'reference_id', e.target.value)}
                    disabled={isDisabled}
                  />
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`notes-${stage.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${stage.id}`}
                    placeholder="Add internal notes..."
                    value={currentUpdate.notes}
                    onChange={(e) => handleUpdateChange(stage.id, 'notes', e.target.value)}
                    disabled={isDisabled}
                  />
                </div>
              )}
              
              <div className="md:col-span-4 flex flex-col space-y-4">
                <StageDocumentUploader
                  candidateId={candidateDetail.id}
                  stageId={stage.id}
                  existingDocuments={documentsForStage}
                  refetch={refetch}
                />
                
                <div className="flex justify-end">
                  <Button 
                    onClick={() => handleSave(stage.id)} 
                    disabled={isDisabled || !isModified}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TimelineEditor;