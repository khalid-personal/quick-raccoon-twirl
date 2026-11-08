import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ListTodo, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getApiPrincipal } from '@/lib/api/auth';
import { getApprovalLogs, getCandidates, getCandidateStages, getConfig, getDocuments, getIntegrityOverrides, getMedicalResults, getPayments, getPaymentStatuses, getStaffUsers } from '@/lib/data-store';
import { amountDiscrepancies, getAgencyResolutionCases } from '@/lib/agency-resolution';
import { buildPortalTasks } from '@/lib/portal-tasks';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function PortalWorkQueue() {
  const { userRole, user, viewAs, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [showAll, setShowAll] = useState(false);
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
      isCandidate ? [] : getAgencyResolutionCases(), isCandidate || isForeign || principal.role === 'auditor' ? [] : amountDiscrepancies());
    }, refetchInterval: 30000,
  });
  return <section data-tour="my-tasks" aria-label="My tasks" className="space-y-4 rounded-2xl border bg-gradient-to-br from-primary/5 to-card p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><ListTodo className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold">{userRole === 'candidate' ? 'Your document reminders' : 'My tasks'}</h2><p className="mt-1 text-sm text-muted-foreground">{
      userRole === 'candidate' ? 'Helpful reminders for your own file. Your agency will confirm exactly what to submit.'
        : userRole === 'viewer' || userRole === 'auditor' ? 'Read-only follow-ups for your account. Review information without changing records.'
          : 'Work requiring your role’s attention. Open the record, take the permitted action and save it there. This queue updates from the records; checking a box cannot bypass required steps.'}</p></div></div>
    <ol className="grid gap-2 rounded-xl bg-background/70 p-4 text-sm sm:grid-cols-3">{(userRole === 'candidate'
      ? ['Read the reminder for your current stage.', 'Ask your agency which document is needed.', 'Submit the requested file in My documents.']
      : userRole === 'viewer' || userRole === 'auditor'
        ? ['Read the follow-up for your account.', 'Open the allowed tracking or review record.', 'Share questions with an authorized staff member.']
        : ['Start with urgent or overdue work.', 'Open the record and check its evidence.', 'Save the action or follow-up on the record.']).map((instruction, index) => <li key={instruction}><strong>{index + 1}.</strong> {instruction}</li>)}</ol>
    {isLoading ? <Loader2 aria-label="Loading tasks" className="h-6 w-6 animate-spin" /> : isError ? <p role="alert" className="text-destructive">Could not load your tasks. Check your account and try again.</p>
      : !tasks.length ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No outstanding {userRole === 'candidate' ? 'document reminders' : 'role-specific follow-ups'}. {userRole === 'candidate' ? 'Check agency messages for any document requests.' : 'Assigned stage work, where available, is listed separately below.'}</p>
        : <div className="grid gap-3 lg:grid-cols-2">{(showAll ? tasks : tasks.slice(0, 8)).map(task => <article key={task.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={task.severity === 'critical' || task.severity === 'high' ? 'destructive' : 'secondary'}>{task.category}</Badge>{task.dueAt && <span className="text-xs text-muted-foreground">{task.dueAt.slice(0, 10) < new Date().toISOString().slice(0, 10) ? 'Overdue · ' : 'Reply by '}{task.dueAt.slice(0, 10)}</span>}</div>
          <h3 className="font-semibold">{task.title}</h3><p className="text-sm text-muted-foreground">{task.detail}</p>
          <Button asChild variant="outline" size="sm" className="mt-auto self-start"><Link to={task.path}>{userRole === 'candidate' ? 'Open documents' : userRole === 'viewer' ? 'Open tracking' : 'Open task'}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </article>)}</div>}
    {tasks.length > 8 && <Button variant="ghost" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer tasks' : `Show all ${tasks.length} tasks`}</Button>}
  </section>;
}
