import { useMemo, useState } from 'react';
import { ArrowRight, Crosshair, Radar } from 'lucide-react';
import { usePortalData } from '@/hooks/use-portal-data';
import { ALL_STAGES } from '@/lib/types';
import { getActiveStageTasks } from '@/lib/staff-tasks';
import { isCleared } from '@/lib/ksa-visa';
import { agencyIsSuspended } from '@/lib/agency-resolution';
import { isStageComplete } from '@/lib/candidate-stage-normalization';
import { CandidateWorkspaceLink } from './CandidateQuickViewProvider';
import CandidateAvatar from './CandidateAvatar';
import { Button } from './ui/button';

type Lane = number | 'ministry' | 'complete' | 'untracked';
export default function JourneyRadar({ localAgencyId }: { localAgencyId?: string }) {
  const data = usePortalData();
  const [lane, setLane] = useState<Lane>(1);
  const [urgent, setUrgent] = useState(false);
  const [paused, setPaused] = useState(false);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const candidates = data.candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId);
    const recorded = candidates.filter(candidate => ALL_STAGES.every(meta => data.stages.some(stage => stage.candidate_id === candidate.id && stage.stage_id === meta.id)));
    const tasks = new Map(getActiveStageTasks(recorded, data.stages, Date.now(), { fees: data.stageFees, payments: data.payments, statuses: data.paymentStatuses }).map(task => [task.candidate.id, task]));
    return candidates.map(candidate => {
      const task = tasks.get(candidate.id);
      const ministry = candidate.clearance?.labour_ministry;
      const held = !!candidate.local_agency_id && agencyIsSuspended('local', candidate.local_agency_id)
        || !!candidate.foreign_agency_id && agencyIsSuspended('foreign', candidate.foreign_agency_id);
      const complete = ALL_STAGES.every(meta => data.stages.some(stage => stage.candidate_id === candidate.id && stage.stage_id === meta.id && isStageComplete(stage.status)));
      const rowLane: Lane = task ? task.stage.stage_id : !complete ? 'untracked' : !isCleared(candidate) ? 'ministry' : 'complete';
      const reason = held ? 'Agency paused · inspect the hold; do not advance operations'
        : task ? `${task.action}${task.overdue ? ' · follow-up overdue' : ' · within recorded follow-up window'}`
          : rowLane === 'untracked' ? 'Stage records are missing · inspect the journey'
            : rowLane === 'ministry' ? ministry?.status === 'rejected' ? 'Ministry rejected · inspect the recorded response'
              : ministry?.status === 'error' ? 'Ministry check error · inspect the recorded response'
                : ministry?.simulated ? 'Practice clearance only · no official approval'
                  : 'Local stages complete · official clearance still required'
              : 'Stages complete and official clearance recorded · inspect travel evidence';
      return { candidate, task, lane: rowLane, reason, urgent: held || rowLane === 'untracked' || !!task?.overdue || task?.stage.status === 'Failed' || ministry?.status === 'rejected' || ministry?.status === 'error' };
    }).sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.task?.dueAt ?? '').localeCompare(b.task?.dueAt ?? '') || a.candidate.tracking_code.localeCompare(b.candidate.tracking_code));
  }, [data, localAgencyId]);
  const counts = ALL_STAGES.map(stage => rows.filter(row => row.lane === stage.id).length);
  const percentage = (index: number) => rows.length ? counts.slice(0, index + 1).reduce((sum, count) => sum + count, 0) / rows.length * 100 : 0;
  const ring = `conic-gradient(#c8f575 0% ${percentage(0)}%, #5ec4b3 ${percentage(0)}% ${percentage(1)}%, #9ec7a7 ${percentage(1)}% ${percentage(2)}%, #f2f1dc ${percentage(2)}% ${percentage(3)}%, #ffffff18 ${percentage(3)}% 100%)`;
  const visible = rows.filter(row => row.lane === lane && (!urgent || row.urgent));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / 3) - 1));
  const select = (value: Lane) => { setLane(value); setPage(0); };
  const title = typeof lane === 'number' ? ALL_STAGES.find(stage => stage.id === lane)?.title : lane === 'ministry' ? 'Ministry handoff' : lane === 'complete' ? 'Cleared journey' : 'Missing journey records';
  return <section aria-label="Journey radar" className="journey-radar overflow-hidden rounded-3xl border bg-card shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3 p-5 pb-2"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Radar className="h-4 w-4" />Operations intelligence</p><h2 className="mt-2 text-2xl font-semibold">Journey radar</h2></div><Button size="sm" variant={urgent ? 'default' : 'outline'} aria-pressed={urgent} onClick={() => { setUrgent(value => !value); setPage(0); }}><Crosshair className="mr-2 h-4 w-4" />Priority lens {rows.filter(row => row.urgent).length}</Button></header>
    <p className="px-5 text-sm text-muted-foreground">Tap a stage to inspect its next follow-ups. Switch on Priority lens for overdue work, failed checks and agency holds. Read-only oversight—not workload reassignment.</p>
    <div className="journey-radar-map m-5 rounded-2xl">
      <div className="journey-radar-ring" style={{ background: ring }} aria-hidden="true"><div className="journey-radar-sweep" style={{ animationPlayState: paused ? 'paused' : 'running' }} /></div>
      <div className="journey-radar-core"><p className="text-3xl font-semibold tabular-nums">{rows.length}</p><p className="text-xs">candidates in scope</p></div>
      {ALL_STAGES.map((stage, index) => <button type="button" key={stage.id} className={`journey-radar-node radar-node-${index}`} aria-pressed={lane === stage.id} onClick={() => select(stage.id)}>
        <span className="text-xs font-medium">0{index + 1} · {stage.title}</span><span className="mt-1 block text-2xl font-semibold tabular-nums">{counts[index]}</span><span className="text-xs opacity-70">next follow-ups <ArrowRight className="inline h-3 w-3" /></span>
      </button>)}
    </div>
    <div className="flex flex-wrap gap-2 px-5" role="group" aria-label="Journey handoff lanes">{(['ministry', 'complete', 'untracked'] as const).map(value =>
      <Button type="button" size="sm" variant={lane === value ? 'default' : 'outline'} aria-pressed={lane === value} key={value} onClick={() => select(value)}>{value === 'ministry' ? 'Ministry handoff' : value === 'complete' ? 'Cleared journey' : 'Missing records'} · {rows.filter(row => row.lane === value).length}</Button>)}</div>
    <div className="space-y-3 p-5" aria-live="polite" aria-atomic="false">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3><span className="text-xs text-muted-foreground">{visible.length} {urgent ? 'priority' : 'recorded'} follow-ups</span></div>
      {visible.slice(currentPage * 3, currentPage * 3 + 3).map(row => <CandidateWorkspaceLink candidateId={row.candidate.id} to={`/admin/candidate/${row.candidate.id}`} key={row.candidate.id} className="flex items-center gap-3 rounded-xl border bg-background/60 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
        <CandidateAvatar candidate={row.candidate} className="h-10 w-10 shrink-0" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.candidate.first_name} {row.candidate.last_name}</p><p className="text-xs leading-relaxed text-muted-foreground">{row.reason}</p>{row.task && <p className="mt-1 text-xs text-muted-foreground">Follow-up: {new Date(row.task.dueAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Addis_Ababa' })} · {row.task.stage.assigned_staff_id ? 'Owner assigned' : 'Owner not assigned'}</p>}</div><ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </CandidateWorkspaceLink>)}
      {!visible.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{urgent ? 'No priority follow-ups in this lane. Turn off Priority lens to see all records.' : 'No candidates in this lane. Choose another stage or handoff.'}</p>}
      {visible.length > 3 && <div className="flex items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-xs text-muted-foreground">{currentPage * 3 + 1}–{Math.min(visible.length, currentPage * 3 + 3)} of {visible.length}</span><Button size="sm" variant="outline" disabled={(currentPage + 1) * 3 >= visible.length} onClick={() => setPage(currentPage + 1)}>Next people</Button></div>}
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Recorded view · decorative scan, not a live ministry feed</span><button type="button" className="shrink-0 text-xs font-semibold text-primary underline" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume scan' : 'Pause scan'}</button></div>
      <p className="text-xs text-muted-foreground">Each person appears in one lane. Fees and stage order remain gated; a ministry response never completes missing stages. Clearance records are not proof of departure.</p>
    </div>
  </section>;
}
