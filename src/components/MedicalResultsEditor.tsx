import React, { useState, useEffect, useRef } from 'react';
import type { CandidateDetail, MedicalStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle, HeartPulse, CheckCircle2, Clock3, FileCheck2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface MedicalResultsEditorProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const EXAM_TYPES = ['HIV', 'Pregnancy', 'Final Agency Medical'];
const STATUS_OPTIONS: MedicalStatus[] = ['Pending', 'Passed', 'Failed'];
const EXAM_PRESENTATION = {
  Pending: { icon: Clock3, color: 'text-amber-700 dark:text-amber-300', surface: 'border-amber-500/25 bg-amber-500/10', label: 'Awaiting result' },
  Passed: { icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-300', surface: 'border-emerald-500/25 bg-emerald-500/10', label: 'Passed' },
  Failed: { icon: AlertTriangle, color: 'text-rose-700 dark:text-rose-300', surface: 'border-rose-500/25 bg-rose-500/10', label: 'Needs review' },
};

interface ExamUpdate {
  status: MedicalStatus;
  exam_date: string;
}

const MedicalResultsEditor: React.FC<MedicalResultsEditorProps> = ({ candidateDetail, refetch }) => {
  const [updates, setUpdates] = useState<Record<string, ExamUpdate>>({});
  const [savingExam, setSavingExam] = useState<string | null>(null);
  const isSaving = savingExam !== null;
  const savedUpdates = useRef<{ candidateId: string; exams: Record<string, ExamUpdate> } | null>(null);

  useEffect(() => {
    const initialUpdates: Record<string, ExamUpdate> = {};
    
    const examTypes = candidateDetail.gender === 'male' ? EXAM_TYPES.filter(type => type !== 'Pregnancy') : EXAM_TYPES;
    examTypes.forEach(examType => {
      const existingResult = candidateDetail.medical_results.find(mr => mr.exam_type === examType);
      
      initialUpdates[examType] = {
        status: existingResult?.status || 'Pending',
        exam_date: existingResult?.exam_date ? existingResult.exam_date.split('T')[0] : '',
      };
    });
    
    const previousSaved = savedUpdates.current;
    setUpdates(previous => {
      if (previousSaved?.candidateId !== candidateDetail.id) return initialUpdates;
      const nextUpdates = { ...initialUpdates };
      Object.keys(initialUpdates).forEach(examType => {
        const draft = previous[examType];
        const baseline = previousSaved.exams[examType];
        if (draft && baseline && (draft.status !== baseline.status || draft.exam_date !== baseline.exam_date)) {
          nextUpdates[examType] = draft;
        }
      });
      return nextUpdates;
    });
    savedUpdates.current = { candidateId: candidateDetail.id, exams: initialUpdates };
  }, [candidateDetail.id, candidateDetail.gender, candidateDetail.medical_results]);

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

    setSavingExam(examType);
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
      setSavingExam(null);
    }
  };
  
  const isPregnancyFailed = candidateDetail.gender !== 'male' && candidateDetail.medical_results.some(mr => mr.exam_type === 'Pregnancy' && mr.status === 'Failed');
  const examTypes = candidateDetail.gender === 'male' ? EXAM_TYPES.filter(type => type !== 'Pregnancy') : EXAM_TYPES;
  const savedResults = examTypes.map(examType => candidateDetail.medical_results.find(result => result.exam_type === examType));
  const passedCount = savedResults.filter(result => result?.status === 'Passed').length;
  const failedCount = savedResults.filter(result => result?.status === 'Failed').length;
  const pendingCount = examTypes.length - passedCount - failedCount;
  const allPassed = passedCount === examTypes.length;
  const summaryTitle = failedCount ? 'A result needs your attention' : allPassed ? 'Recorded checks complete' : 'Keep medical checks moving';
  const summaryTheme = EXAM_PRESENTATION[failedCount ? 'Failed' : allPassed ? 'Passed' : 'Pending'];
  const medicalTotals: Array<{ label: string; count: number; status: MedicalStatus }> = [
    { label: 'Passed', count: passedCount, status: 'Passed' },
    { label: 'Awaiting result', count: pendingCount, status: 'Pending' },
    { label: 'Needs review', count: failedCount, status: 'Failed' },
  ];

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-3xl border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-emerald-500/10">
        <CardContent className="relative space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex max-w-xl items-start gap-4">
              <span className="control-nav-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"><HeartPulse className="h-8 w-8" /></span>
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Candidate health checkpoint</p><CardTitle className="text-2xl font-bold sm:text-3xl">Medical compliance</CardTitle><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Review the saved results, record each exam and keep the Medical stage up to date.</p></div>
            </div>
            <div className={`rounded-2xl border px-5 py-4 ${summaryTheme.surface} ${summaryTheme.color}`}>
              <p className="text-3xl font-bold tabular-nums">{passedCount}<span className="text-lg font-medium opacity-70"> / {examTypes.length}</span></p>
              <p className="mt-1 text-sm font-semibold">Required exams passed</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className={`flex items-center gap-2 font-semibold ${summaryTheme.color}`}><ShieldCheck className="h-5 w-5" />{summaryTitle}</p><span className="text-xs text-muted-foreground">Saved results only · drafts excluded</span></div>
            <div className="grid gap-2 sm:grid-cols-3" aria-label="Saved medical result totals">
              {medicalTotals.map(item => {
                const presentation = EXAM_PRESENTATION[item.status];
                const Icon = presentation.icon;
                return <div key={item.status} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${presentation.surface} ${presentation.color}`}><span className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{item.label}</span><span className="text-xl font-bold tabular-nums">{item.count}</span></div>;
              })}
            </div>
          </div>
          {isPregnancyFailed && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-800 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-bold">Flight booking is blocked</p><p className="mt-1 text-sm">The saved Pregnancy result is Failed. Review the supporting medical record before updating this result.</p></div>
            </div>
          )}
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />Medical results update the timeline. Passing these checks alone does not authorize a flight or replace official deployment clearance. Training must be completed before recording results.</p>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-3">
      {examTypes.map((examType, index) => {
        const fieldId = (field: string) => `${candidateDetail.id}-${examType.replace(/\s+/g, '-')}-${field}`;
        const existingResult = candidateDetail.medical_results.find(mr => mr.exam_type === examType);
        const currentUpdate = updates[examType];
        
        const isModified = currentUpdate?.status !== existingResult?.status || 
                           currentUpdate?.exam_date !== (existingResult?.exam_date ? existingResult.exam_date.split('T')[0] : '');
        
        const currentStatus = existingResult?.status || 'Pending';
        const presentation = EXAM_PRESENTATION[currentStatus];
        const StatusIcon = presentation.icon;
        const hasDraftChanges = currentUpdate && (currentUpdate.status !== currentStatus || currentUpdate.exam_date !== (existingResult?.exam_date?.split('T')[0] ?? ''));
        
        return (
          <Card key={examType} className={`overflow-hidden rounded-2xl border-t-4 ${presentation.surface}`} aria-label={`${examType} medical exam`}>
            <CardHeader className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl border bg-background/70 ${presentation.color}`}><StatusIcon className="h-6 w-6" /></span><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required exam {index + 1}</span></div>
              <div><CardTitle className="text-xl leading-tight">{examType}</CardTitle><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`border bg-background/70 ${presentation.color}`}>{existingResult ? presentation.label : 'Not recorded'}</Badge>{hasDraftChanges && <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">Unsaved changes</Badge>}</div></div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              
              <div className="space-y-2">
                <Label htmlFor={fieldId('status')}>Result Status</Label>
                <Select
                  value={currentUpdate?.status ?? 'Pending'}
                  onValueChange={(value: MedicalStatus) => handleUpdateChange(examType, 'status', value)}
                  disabled={isSaving}
                >
                  <SelectTrigger id={fieldId('status')} className="h-12 rounded-xl bg-background/80">
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
                <Label htmlFor={fieldId('date')}>Exam Date</Label>
                <Input
                  id={fieldId('date')}
                  type="date"
                  value={currentUpdate?.exam_date ?? ''}
                  onChange={(e) => handleUpdateChange(examType, 'exam_date', e.target.value)}
                  disabled={isSaving}
                  className="h-12 rounded-xl bg-background/80"
                />
              </div>
              
              <div className="border-t pt-4">
                <Button 
                  onClick={() => handleSave(examType)} 
                  disabled={isSaving || !isModified}
                  className="h-12 w-full rounded-xl text-base"
                >
                  {savingExam === examType ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                  {savingExam === examType ? `Saving ${examType}…` : `Save ${examType}`}
                </Button>
              </div>
              
              {existingResult?.exam_date && (
                <p className="text-xs text-muted-foreground">
                  Recorded exam date: {format(new Date(existingResult.exam_date), 'PPP')}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
};

export default MedicalResultsEditor;