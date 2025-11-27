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

interface TimelineEditorProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const statusOptions: StageStatus[] = ['Pending', 'In Progress', 'Passed', 'Failed', 'Issued', 'Completed'];

const TimelineEditor: React.FC<TimelineEditorProps> = ({ candidateDetail, refetch }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [stageUpdates, setStageUpdates] = useState<{
    [stageId: number]: { status: StageStatus; notes: string; date: string };
  }>({});

  React.useEffect(() => {
    // Initialize state from candidate detail
    const initialUpdates: { [stageId: number]: { status: StageStatus; notes: string; date: string } } = {};
    candidateDetail.stages.forEach(cs => {
      initialUpdates[cs.stage_id] = {
        status: cs.status,
        notes: cs.notes || '',
        date: cs.date ? cs.date.split('T')[0] : '', // Format date for input type="date"
      };
    });
    setStageUpdates(initialUpdates);
  }, [candidateDetail]);

  const handleUpdateChange = (stageId: number, field: 'status' | 'notes' | 'date', value: string) => {
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
        update.date || undefined
      );
      toast.success(`${ALL_STAGES.find(s => s.id === stageId)?.title} status updated.`);
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {candidateDetail.stages.map((cs) => {
        const stage = ALL_STAGES.find(s => s.id === cs.stage_id)!;
        const currentUpdate = stageUpdates[stage.id] || { status: cs.status, notes: cs.notes || '', date: cs.date ? cs.date.split('T')[0] : '' };
        const isModified = currentUpdate.status !== cs.status || currentUpdate.notes !== (cs.notes || '') || currentUpdate.date !== (cs.date ? cs.date.split('T')[0] : '');

        return (
          <Card key={stage.id}>
            <CardHeader className={cn("flex flex-row items-center justify-between p-4", getStatusColor(cs.status))}>
              <CardTitle className="text-white text-lg">{stage.title}</CardTitle>
              <Badge variant="secondary" className="text-sm font-semibold">
                Current: {cs.status}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="space-y-2">
                <Label htmlFor={`status-${stage.id}`}>Status</Label>
                <Select
                  value={currentUpdate.status}
                  onValueChange={(value: StageStatus) => handleUpdateChange(stage.id, 'status', value)}
                  disabled={isSaving}
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
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`notes-${stage.id}`}>Notes</Label>
                <Textarea
                  id={`notes-${stage.id}`}
                  placeholder="Add internal notes..."
                  value={currentUpdate.notes}
                  onChange={(e) => handleUpdateChange(stage.id, 'notes', e.target.value)}
                  disabled={isSaving}
                />
              </div>
              
              <div className="md:col-span-4 flex justify-end">
                <Button 
                  onClick={() => handleSave(stage.id)} 
                  disabled={isSaving || !isModified}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TimelineEditor;