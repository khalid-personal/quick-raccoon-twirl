import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowUpRight, CalendarDays, Check, CircleDashed, Clock3, FileText, GraduationCap, HeartPulse, ListChecks, Plane, ClipboardList, X, BadgeCheck, BadgeAlert, MinusCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CandidateDetail, ALL_STAGES, CandidateStage } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import { Badge } from '@/components/ui/badge';
import { getStatusColor, cn } from '@/lib/utils';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import StageEditorDialog from './StageEditorDialog';
import { usePortalData } from '@/hooks/use-portal-data';
import { stageFeeCovered } from '@/lib/stage-readiness';

interface TimelineEditorProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
  workspace?: { stageId?: number; onStageHandled: () => void };
}

const isComplete = (status: CandidateStage['status']) => ['Passed', 'Issued', 'Completed'].includes(status);
const STAGE_ICONS: Record<string, LucideIcon> = {
  registration: ClipboardList,
  training: GraduationCap,
  medical: HeartPulse,
  deployment: Plane,
};

const TimelineEditor: React.FC<TimelineEditorProps> = ({ candidateDetail, refetch, workspace }) => {
  const [openStageIds, setOpenStageIds] = useState<number[]>([]);
  useEffect(() => setOpenStageIds([]), [candidateDetail.id]);
  const [params, setParams] = useSearchParams();
  const requestedStage = workspace ? workspace.stageId : Number(params.get('stage'));
  useEffect(() => {
    if (typeof requestedStage === 'number' && ALL_STAGES.some(stage => stage.id === requestedStage) && candidateDetail.stages.some(stage => stage.stage_id === requestedStage)) setOpenStageIds(previous => previous.includes(requestedStage) ? previous : [...previous, requestedStage]);
  }, [requestedStage, candidateDetail.id, candidateDetail.stages]);
  const changeStage = (isOpen: boolean, stageId: number) => {
    setOpenStageIds(previous => isOpen ? previous.includes(stageId) ? previous : [...previous, stageId] : previous.filter(id => id !== stageId));
    if (!isOpen && workspace && stageId === requestedStage) { workspace.onStageHandled(); return; }
    if (!isOpen && stageId === requestedStage && params.has('stage')) {
      const next = new URLSearchParams(params);
      next.delete('stage');
      setParams(next, { replace: true });
    }
  };
  const { paymentStatuses, stageFees, payments } = usePortalData();
  const stages = [...candidateDetail.stages]
    .sort((a, b) => (ALL_STAGES.find(stage => stage.id === a.stage_id)?.ordinal ?? 0) - (ALL_STAGES.find(stage => stage.id === b.stage_id)?.ordinal ?? 0))
    .map(candidateStage => ({ candidateStage, stage: ALL_STAGES.find(stage => stage.id === candidateStage.stage_id) }))
    .filter((item): item is { candidateStage: CandidateStage; stage: (typeof ALL_STAGES)[number] } => !!item.stage);
  const completed = stages.filter(item => isComplete(item.candidateStage.status)).length;
  const deploymentStatus = stages.find(item => item.stage.slug === 'deployment')?.candidateStage.status ?? 'Not recorded';
  const attention = stages.filter(item => item.candidateStage.status === 'Failed').length;
  const progress = stages.length ? Math.round(completed / stages.length * 100) : 0;
  const summary = [
    { label: 'Stages complete', value: `${completed} / ${stages.length}`, icon: Check, color: 'text-emerald-600 bg-emerald-500/10' },
    {
      label: 'Deployment status',
      value: deploymentStatus,
      icon: Plane,
      color: deploymentStatus === 'Completed' || deploymentStatus === 'Passed' || deploymentStatus === 'Issued' ? 'text-emerald-600 bg-emerald-500/10'
        : deploymentStatus === 'In Progress' ? 'text-blue-600 bg-blue-500/10'
          : deploymentStatus === 'Failed' ? 'text-rose-600 bg-rose-500/10'
            : deploymentStatus === 'Pending' ? 'text-amber-600 bg-amber-500/10'
              : 'text-muted-foreground bg-muted',
      valueColor: deploymentStatus === 'Completed' || deploymentStatus === 'Passed' || deploymentStatus === 'Issued' ? 'text-emerald-700 dark:text-emerald-300'
        : deploymentStatus === 'In Progress' ? 'text-blue-700 dark:text-blue-300'
          : deploymentStatus === 'Failed' ? 'text-rose-700 dark:text-rose-300'
            : deploymentStatus === 'Pending' ? 'text-amber-700 dark:text-amber-300'
              : 'text-foreground',
    },
    { label: 'Needs attention', value: attention, icon: X, color: attention ? 'text-rose-600 bg-rose-500/10' : 'text-muted-foreground bg-muted' },
    { label: 'Overall progress', value: `${progress}%`, icon: ListChecks, color: 'text-primary bg-primary/10' },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-cyan-500/25 shadow-sm">
        <CandidateCheckpoint eyebrow="Application progress" title="Candidate journey" description="Open a stage to check its progress, update details or add documents. Complete the steps in order: Registration → Training → Medical → Deployment." icon={ListChecks} metric={`${completed} / ${stages.length}`} metricLabel="Stages complete" />
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="space-y-2" aria-label={`${progress}% of candidate stages complete`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Journey progress</span><span className="font-semibold tabular-nums text-foreground">{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map(({ label, value, icon: Icon, color, valueColor }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-background/70 p-3">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}><Icon className="h-4 w-4" /></span>
                <div><p className="text-xs text-muted-foreground">{label}</p><p className={cn('text-lg font-semibold tabular-nums', valueColor)}>{value}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stages.map(({ candidateStage, stage }, index) => {
          const IconComponent = STAGE_ICONS[stage.slug];
          const done = isComplete(candidateStage.status);
          const failed = candidateStage.status === 'Failed';
          const active = candidateStage.status === 'In Progress';
          const stageDocuments = candidateDetail.documents.filter(document => document.stage_id === stage.id);
          const stageFee = stageFees[stage.id] ?? stage.fee_amount ?? 0;
          const feePaid = stageFeeCovered(candidateDetail, stage.id, stageFees, paymentStatuses, payments);
          const PaymentIcon = stageFee <= 0 ? MinusCircle : feePaid ? BadgeCheck : BadgeAlert;
          const iconTone = failed ? 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
            : done ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
              : active ? 'bg-blue-500/10 text-blue-600 ring-blue-500/20'
                : 'bg-muted text-muted-foreground ring-border';
          const StatusIcon = failed ? X : done ? Check : active ? Clock3 : CircleDashed;

          return (
            <Dialog
              key={stage.id}
              open={openStageIds.includes(stage.id)}
              onOpenChange={isOpen => changeStage(isOpen, stage.id)}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'group relative flex min-h-52 w-full flex-col rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    failed && 'border-rose-500/30',
                    active && 'border-blue-500/30',
                    done && 'border-emerald-500/25',
                  )}
                  aria-label={`Edit ${stage.title} stage, current status ${candidateStage.status}`}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset', iconTone)}>
                      {IconComponent ? <IconComponent className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </span>
                    <Badge className={cn('rounded-full px-2.5 py-1 text-[11px]', getStatusColor(candidateStage.status))}>{candidateStage.status}</Badge>
                  </div>
                  <div className="mt-5 flex w-full items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage {index + 1}</span>
                    <span className="h-px flex-1 bg-border" />
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{stage.title}</h3>
                  <div className="mt-auto flex w-full flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-muted-foreground">
                    {candidateStage.date && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(candidateStage.date), 'MMM d, yyyy')}</span>}
                    <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{stageDocuments.length} {stageDocuments.length === 1 ? 'document' : 'documents'}</span>
                  </div>
                  <div className={cn(
                    'mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium',
                    stageFee <= 0 ? 'bg-muted text-muted-foreground' : feePaid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  )}>
                    <PaymentIcon className="h-4 w-4 shrink-0" />
                    <span>{stageFee <= 0 ? 'No stage fee configured' : feePaid ? 'Stage fee paid' : 'Stage fee unpaid · completion blocked'}</span>
                    {stageFee > 0 && <span className="ml-auto tabular-nums">{stageFee.toLocaleString()} ETB</span>}
                  </div>
                  {candidateStage.notes?.trim() && <p className="mt-3 line-clamp-2 w-full border-t pt-3 text-xs leading-relaxed text-muted-foreground">{candidateStage.notes}</p>}
                  <span className="sr-only">Open stage editor</span>
                </button>
              </DialogTrigger>
              {openStageIds.includes(stage.id) && <StageEditorDialog
                candidateDetail={candidateDetail}
                candidateStage={candidateStage}
                stage={stage}
                refetch={refetch}
                onClose={() => changeStage(false, stage.id)}
              />}
            </Dialog>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineEditor;
