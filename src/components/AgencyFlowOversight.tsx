import { ALL_STAGES } from '@/lib/types';
import { getCandidateStages, getCandidates, getConfig, getLocalAgencies, getPayments, getPaymentStatuses, getStaffUsers } from '@/lib/data-store';
import { getActiveStageTasks } from '@/lib/staff-tasks';
import { getAgencyResolutionCases } from '@/lib/agency-resolution';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CandidateWorkspaceLink } from './CandidateQuickViewProvider';
import { Progress } from './ui/progress';
import { stageFeeCovered, stageIsComplete } from '@/lib/stage-readiness';

export default function AgencyFlowOversight() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['agency-flow-oversight'] }); };
    window.addEventListener('demo-scenario-changed', refresh); window.addEventListener('agency-resolution-changed', refresh);
    return () => { window.removeEventListener('demo-scenario-changed', refresh); window.removeEventListener('agency-resolution-changed', refresh); };
  }, [queryClient]);
  const { data, isError } = useQuery({
    queryKey: ['agency-flow-oversight', 'serializable-roster'],
    queryFn: () => {
      const candidates = getCandidates(), stages = getCandidateStages();
      const context = { fees: getConfig().stageFees ?? {}, statuses: getPaymentStatuses(), payments: getPayments() };
      const tasks = getActiveStageTasks(candidates, stages, Date.now(), context);
      const approved = getStaffUsers().filter(person => person.role === 'staff' && person.is_approved);
      const holds = [...new Set(getAgencyResolutionCases().filter(record => record.holdActive).map(record => record.issue.agencyId))];
      const deployed = candidates.filter(candidate => ALL_STAGES.every(meta => stageIsComplete(stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === meta.id)?.status ?? 'Pending')
        && stageFeeCovered(candidate, meta.id, context.fees, context.statuses, context.payments))).length;
      return { candidates, tasks, approved, holds, deployed, agencies: getLocalAgencies() };
    },
    refetchInterval: 30000,
  });
  if (isError) return <p role="alert">Could not load agency flow. Refresh and try again.</p>;
  if (!data) return <p role="status">Loading agency flow…</p>;
  return <section data-tour="workload-manager" aria-label="Agency flow oversight" className="space-y-5 rounded-2xl border bg-card p-5">
    <header><h2 className="text-xl font-semibold">Agency flow oversight</h2><p className="mt-2 text-sm text-muted-foreground">See where registration-to-deployment work is moving or blocked. Local agency admins own assignments and workload balance; your work is investigating flags, reviewing appeals and recording decisions.</p></header>
    <ol aria-label="Registration to deployment flow" className="portal-metric-grid">
      {[...ALL_STAGES.map(stage => ({ title: stage.title, count: data.tasks.filter(task => task.stage.stage_id === stage.id).length })), { title: 'Deployed / historical', count: data.deployed }].map(step => <li key={step.title} className="rounded-xl border bg-primary/5 p-4"><p className="text-sm font-medium">{step.title}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{step.count}</p><Progress className="mt-3" value={step.count / Math.max(1, data.candidates.length) * 100} aria-label={`${step.title} share`} /></li>)}
    </ol>
    <div className="portal-record-grid">{data.agencies.map(agency => {
      const candidates = data.candidates.filter(candidate => candidate.local_agency_id === agency.id);
      const tasks = data.tasks.filter(task => task.candidate.local_agency_id === agency.id);
      const overdue = tasks.filter(task => task.overdue).length;
      const awaiting = tasks.filter(task => task.action === 'Await payment').length;
      const unowned = tasks.filter(task => !data.approved.some(person => person.id === task.stage.assigned_staff_id && person.local_agency_id === agency.id)).length;
      const held = candidates.filter(candidate => data.holds.includes(agency.id) || !!candidate.foreign_agency_id && data.holds.includes(candidate.foreign_agency_id)).length;
      return <article key={agency.id} className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{agency.name}</h3><p className="text-sm text-muted-foreground">{candidates.length} candidates · {tasks.length} active stages · {overdue} overdue</p><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-lg bg-amber-500/10 p-2">{awaiting} awaiting fees</span><span className="rounded-lg bg-muted p-2">{unowned} need an eligible owner</span><span className="rounded-lg bg-destructive/5 p-2">{held} linked to paused agencies</span></div>{tasks[0] && <CandidateWorkspaceLink candidateId={tasks[0].candidate.id} to={`/admin/candidate/${tasks[0].candidate.id}`} className="inline-block text-sm font-semibold text-primary underline">Inspect earliest candidate follow-up</CandidateWorkspaceLink>}</article>;
    })}</div>
    <p className="text-sm text-muted-foreground">{data.candidates.length - data.tasks.length - data.deployed} candidates need missing stage records checked. Counts describe records, not proof of misconduct. Payment blockers and agency holds remain in force; this view does not assign staff or authorize travel.</p>
  </section>;
}
