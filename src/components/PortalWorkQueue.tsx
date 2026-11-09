import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ListTodo, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getApiPrincipal } from '@/lib/api/auth';
import { getApprovalLogs, getCandidates, getCandidateStages, getConfig, getDocuments, getIntegrityOverrides, getMedicalResults, getPayments, getPaymentStatuses, getStaffUsers, getLocalAgencies } from '@/lib/data-store';
import { amountDiscrepancies, getAgencyResolutionCases } from '@/lib/agency-resolution';
import { buildPortalTasks } from '@/lib/portal-tasks';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import FindingInvestigation from './FindingInvestigation';
import { investigationEscalated } from '@/lib/integrity-investigations';
import { navigationItemClass, navigationRail } from './ui/navigation-rail';
import { loadReconciliationEvents } from '@/lib/bank-statement-store';
import { currentVerifiedPaymentIds } from '@/lib/payment-review-clearance';

export default function PortalWorkQueue() {
  const { userRole, user, viewAs, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'flags' | 'suspicious' | 'appeals'>('all');
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['portal-work-queue'] }); };
    window.addEventListener('bank-statement-changed', refresh);
    window.addEventListener('demo-scenario-changed', refresh);
    window.addEventListener('supabase-data-changed', refresh);
    window.addEventListener('agency-resolution-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('demo-scenario-changed', refresh);
      window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('agency-resolution-changed', refresh); window.removeEventListener('storage', refresh);
    };
  }, [queryClient]);
  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ['portal-work-queue', viewAs?.userId ?? user?.id, userRole, userLocalAgencyId, userForeignAgencyId],
    queryFn: async () => {
      const principal = await getApiPrincipal();
      if (principal.role === 'viewer') return buildPortalTasks(principal, { candidates: [], stages: [], payments: [], medicals: [], logs: [], paymentStatuses: [] }, [], [], []);
      const isCandidate = principal.role === 'candidate';
      const isForeign = ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(principal.role);
      return buildPortalTasks(principal, {
        candidates: getCandidates(), stages: getCandidateStages(), documents: getDocuments(), payments: getPayments(),
        medicals: isCandidate || isForeign ? [] : getMedicalResults(), logs: isCandidate || isForeign ? [] : getApprovalLogs(),
        paymentStatuses: getPaymentStatuses(), stageFees: getConfig().stageFees ?? {},
      }, isCandidate ? [] : getStaffUsers(), isCandidate || isForeign ? [] : getIntegrityOverrides(),
      isCandidate ? [] : getAgencyResolutionCases(), isCandidate || isForeign || principal.role === 'auditor' ? [] : amountDiscrepancies(),
      principal.role === 'staff' || principal.role === 'local-agency' ? getLocalAgencies().filter(agency => agency.id === principal.localAgencyId).map(agency => ({ agencyId: agency.id, events: loadReconciliationEvents(agency.id) })) : [],
      principal.role === 'staff' || principal.role === 'local-agency' ? currentVerifiedPaymentIds() : new Set());
    }, refetchInterval: 30000,
  });
  const visibleTasks = userRole !== 'superadmin' || filter === 'all' ? tasks : tasks.filter(task => filter === 'flags' ? !!task.finding
    : filter === 'suspicious' ? task.category === 'Suspicious activity' : task.category === 'Agency reply');
  return <section data-tour="my-tasks" aria-label="My tasks" className="space-y-4 rounded-2xl border bg-gradient-to-br from-primary/5 to-card p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><ListTodo className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold">{userRole === 'candidate' ? 'Your document reminders' : 'My tasks'}</h2><p className="mt-1 text-sm text-muted-foreground">{
      userRole === 'candidate' ? 'Helpful reminders for your own file. Your agency will confirm exactly what to submit.'
        : userRole === 'viewer' || userRole === 'auditor' ? 'Read-only follow-ups for your account. Review information without changing records.'
          : userRole === 'superadmin' ? 'Investigate record flags and suspicious patterns, escalate for ministry review or close with an evidence-based reason. Review agency replies and appeals separately; warnings do not prove wrongdoing.'
            : 'Work requiring your role’s attention. Open the record, take the permitted action and save it there. This queue updates from the records; checking a box cannot bypass required steps.'}</p></div></div>
    <ol className="grid gap-2 rounded-xl bg-background/70 p-4 text-sm sm:grid-cols-3">{(userRole === 'candidate'
      ? ['Read the reminder for your current stage.', 'Ask your agency which document is needed.', 'Submit the requested file in My documents.']
      : userRole === 'viewer' || userRole === 'auditor'
        ? ['Read the follow-up for your account.', 'Open the allowed tracking or review record.', 'Share questions with an authorized staff member.']
        : ['Start with urgent or overdue work.', 'Open the record and check its evidence.', 'Save the action or follow-up on the record.']).map((instruction, index) => <li key={instruction}><strong>{index + 1}.</strong> {instruction}</li>)}</ol>
    {userRole === 'superadmin' && <div role="group" aria-label="Investigation queue filters" className={navigationRail}>{([
      ['all', 'All follow-ups'], ['flags', 'Record flags'], ['suspicious', 'Suspicious activity'], ['appeals', 'Agency replies & appeals'],
    ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={navigationItemClass(filter === value)} onClick={() => { setFilter(value); setShowAll(false); }}>{label}</button>)}</div>}
    {isLoading ? <Loader2 aria-label="Loading tasks" className="h-6 w-6 animate-spin" /> : isError ? <p role="alert" className="text-destructive">Could not load your tasks. Check your account and try again.</p>
      : !visibleTasks.length ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No outstanding {userRole === 'candidate' ? 'document reminders' : 'follow-ups in this view'}. {userRole === 'candidate' ? 'Check agency messages for any document requests.' : userRole === 'superadmin' ? 'Local agency admins manage stage assignments separately.' : 'Assigned stage work, where available, is listed separately below.'}</p>
        : <div className="grid gap-3 lg:grid-cols-2">{(showAll ? visibleTasks : visibleTasks.slice(0, 8)).map(task => <article key={task.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={task.severity === 'critical' || task.severity === 'high' ? 'destructive' : 'secondary'}>{task.category}</Badge>{task.dueAt && <span className="text-xs text-muted-foreground">{task.dueAt.slice(0, 10) < new Date().toISOString().slice(0, 10) ? 'Overdue · ' : 'Reply by '}{task.dueAt.slice(0, 10)}</span>}</div>
          <h3 className="font-semibold">{task.title}</h3><p className="text-sm text-muted-foreground">{task.detail}</p>
          {task.finding && <><Badge variant="outline" className="self-start">{investigationEscalated(task.finding.id) ? 'Escalated · review pending' : 'Investigation needed'}</Badge><FindingInvestigation finding={task.finding} /></>}
          <Button asChild variant="outline" size="sm" className="mt-auto self-start"><Link to={task.path}>{task.category === 'Statement upload' ? 'Open statement submission' : userRole === 'candidate' ? 'Open documents' : userRole === 'viewer' ? 'Open tracking' : 'Open task'}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </article>)}</div>}
    {visibleTasks.length > 8 && <Button variant="ghost" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer tasks' : `Show all ${visibleTasks.length} tasks`}</Button>}
  </section>;
}
