import React, { useState, useEffect } from 'react';
import { CandidateDetail, MedicalResult, MedicalStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { getStatusColor, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface MedicalResultsEditorProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const EXAM_TYPES = ['HIV', 'Pregnancy', 'Final Agency Medical'];
const STATUS_OPTIONS: MedicalStatus[] = ['Pending', 'Passed', 'Failed'];

interface ExamUpdate {
  status: MedicalStatus;
  exam_date: string;
}

const MedicalResultsEditor: React.FC<MedicalResultsEditorProps> = ({ candidateDetail, refetch }) => {
  const [updates, setUpdates] = useState<Record<string, ExamUpdate>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initialUpdates: Record<string, ExamUpdate> = {};
    
    EXAM_TYPES.forEach(examType => {
      const existingResult = candidateDetail.medical_results.find(mr => mr.exam_type === examType);
      
      initialUpdates[examType] = {
        status: existingResult?.status || 'Pending',
        exam_date: existingResult?.exam_date ? existingResult.exam_date.split('T')[0] : '',
      };
    });
    
    setUpdates(initialUpdates);
  }, [candidateDetail]);

  const handleUpdateChange = (examType: string, field: keyof ExamUpdate, value: string) => {
    setUpdates(prev => ({
      ...prev,
      [examType]: {
        ...prev[examType],
        [field]: value,
      },
    }));
  };

  const handleSave = async (examType: string) => {
    const update = updates[examType];
    if (!update) return;

    setIsSaving(true);
    try {
      await api.updateMedicalResult(
        candidateDetail.id,
        examType,
        update.status,
        update.exam_date || undefined
      );
      toast.success(`${examType} result updated successfully.`);
      refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const isPregnancyFailed = candidateDetail.medical_results.some(mr => mr.exam_type === 'Pregnancy' && mr.status === 'Failed');
  const isFinalMedicalPassed = candidateDetail.medical_results.some(mr => mr.exam_type === 'Final Agency Medical' && mr.status === 'Passed');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Medical Compliance Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPregnancyFailed && (
            <div className="p-3 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-sm text-red-800 dark:text-red-200 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
              <p className="font-semibold">COMPLIANCE ALERT: Pregnancy test failed. Flight booking is blocked.</p>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Update the status for mandatory medical exams below. These results directly influence the 'Final Medical Clearance' stage in the timeline.
          </p>
        </CardContent>
      </Card>

      {EXAM_TYPES.map(examType => {
        const existingResult = candidateDetail.medical_results.find(mr => mr.exam_type === examType);
        const currentUpdate = updates[examType];
        
        const isModified = currentUpdate?.status !== existingResult?.status || 
                           currentUpdate?.exam_date !== (existingResult?.exam_date ? existingResult.exam_date.split('T')[0] : '');
        
        const currentStatus = existingResult?.status || 'Pending';
        
        return (
          <Card key={examType}>
            <CardHeader className={cn("flex flex-row items-center justify-between p-4", getStatusColor(currentStatus))}>
              <CardTitle className="text-white text-lg">{examType}</CardTitle>
              <Badge variant="secondary" className="text-sm font-semibold">
                Current: {currentStatus}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              
              <div className="space-y-2">
                <Label htmlFor={`status-${examType}`}>Result Status</Label>
                <Select
                  value={currentUpdate?.status}
                  onValueChange={(value: MedicalStatus) => handleUpdateChange(examType, 'status', value)}
                  disabled={isSaving}
                >
                  <SelectTrigger id={`status-${examType}`}>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`date-${examType}`}>Exam Date</Label>
                <Input
                  id={`date-${examType}`}
                  type="date"
                  value={currentUpdate?.exam_date}
                  onChange={(e) => handleUpdateChange(examType, 'exam_date', e.target.value)}
                  disabled={isSaving}
                />
              </div>
              
              <div className="md:col-span-2 flex justify-end">
                <Button 
                  onClick={() => handleSave(examType)} 
                  disabled={isSaving || !isModified}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save {examType}
                </Button>
              </div>
              
              {existingResult?.exam_date && (
                <p className="md:col-span-4 text-xs text-muted-foreground">
                  Last Updated: {format(new Date(existingResult.exam_date), 'PPP')}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default MedicalResultsEditor;