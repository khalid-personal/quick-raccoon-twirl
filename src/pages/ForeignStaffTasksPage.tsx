import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ListTodo, Loader2, Users, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import CandidateAvatar from '@/components/CandidateAvatar';
import PageHeader from '@/components/page/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { assignForeignStaffTask, getForeignStaffWork, rebalanceForeignStaffTasks } from '@/lib/api/foreign-staff-work';
import { actorDisplayName } from '@/lib/demo-identities';

export default function ForeignStaffTasksPage() {
  const { user, userRole, userForeignAgencyId, viewAs } = useAuth();
  const queryClient = useQueryClient();
  const key = ['foreign-staff-work', viewAs?.userId ?? user?.id, userRole, userForeignAgencyId];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: getForeignStaffWork, refetchInterval: 30000 });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['foreign-staff-work'] });
  };
  const balance = useMutation({
    mutationFn: rebalanceForeignStaffTasks,
    onSuccess: result => { toast.success(`${result.assigned} tasks assigned; ${result.changed} assignments changed.`); refresh(); },
    onError: error => { toast.error(error instanceof Error ? error.message : 'Could not balance work.'); refresh(); },
  });
  const assign = useMutation({
    mutationFn: ({ candidateId, stageId, staffId }: { candidateId: string; stageId: number; staffId: string }) =>
      assignForeignStaffTask(candidateId, stageId, staffId),
    onSuccess: () => { toast.success('Assignment updated.'); refresh(); },
    onError: error => { toast.error(error instanceof Error ? error.message : 'Could not assign work.'); refresh(); },
  });
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (isError || !data) return <p role="alert" className="text-destructive">Could not load agency workload. Check your account and try again.</p>;
  const names = new Map(data.staff.map(person => [person.id, actorDisplayName(person.id, person.email)]));
  const unassigned = data.tasks.filter(task => !names.has(task.stage.foreign_assigned_staff_id ?? '')).length;
  return <div className="space-y-6">
    <PageHeader title={data.canManage ? 'Staff Workload' : 'My Work'}
      description={data.canManage ? 'Assign your agency’s current candidate tasks to approved team members.' : 'Your current candidate tasks and follow-ups.'}
      actions={data.canManage ? <Button onClick={() => balance.mutate()} disabled={balance.isPending || !data.staff.length}>
        {balance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
        Balance agency work
      </Button> : undefined} />
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-background"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ListTodo className="h-4 w-4" /> Current tasks</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{data.tasks.length}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Awaiting payment</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{data.tasks.filter(task => task.action === 'Awaiting payment').length}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> {data.canManage ? 'Need an owner' : 'Assigned to you'}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{data.canManage ? unassigned : data.tasks.length}</CardContent></Card>
    </div>
    {data.canManage && !data.staff.length && <p className="text-sm text-muted-foreground">Approve agency staff accounts before assigning work.</p>}
    {data.canManage && !!data.staff.length && <section aria-label="Team workload" className="rounded-2xl border bg-card p-5"><h2 className="mb-4 font-semibold">Work by staff member</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.staff.map(person => {
      const tasks = data.tasks.filter(task => task.stage.foreign_assigned_staff_id === person.id);
      return <div key={person.id} className="rounded-xl bg-muted/35 p-4"><p className="font-medium">{names.get(person.id)}</p><p className="mt-1 text-sm text-muted-foreground">{tasks.length} current tasks · {tasks.filter(task => task.action === 'Awaiting payment').length} awaiting payment</p></div>;
    })}</div></section>}
    <div className="grid gap-4 lg:grid-cols-2">
      {data.tasks.map(task => <Card key={task.stage.id} className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <CandidateAvatar candidate={task.candidate} className="h-12 w-12" />
            <div className="min-w-0 flex-1"><h2 className="font-semibold">{task.candidate.first_name} {task.candidate.last_name}</h2><p className="font-mono text-xs text-muted-foreground">{task.candidate.tracking_code}</p></div>
            <Badge variant={task.action === 'Awaiting payment' || task.action === 'Resolve blocker' ? 'secondary' : 'outline'}>{task.action}</Badge>
          </div>
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Current stage</p><p className="font-medium">{task.stageTitle}</p></div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            {data.canManage ? <div className="min-w-48"><p className="mb-1 text-xs text-muted-foreground">Assigned to</p><Select value={names.has(task.stage.foreign_assigned_staff_id ?? '') ? task.stage.foreign_assigned_staff_id : undefined} onValueChange={staffId => assign.mutate({ candidateId: task.candidate.id, stageId: task.stage.stage_id, staffId })} disabled={assign.isPending || !data.staff.length}><SelectTrigger aria-label={`Assign ${task.candidate.first_name} ${task.candidate.last_name}`}><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent>{data.staff.map(person => <SelectItem key={person.id} value={person.id}>{names.get(person.id)}</SelectItem>)}</SelectContent></Select></div> : <span className="text-sm text-muted-foreground">Assigned to you</span>}
            <Button asChild variant="outline" size="sm"><Link to={`/agency/candidate/${task.candidate.id}`}>Open candidate <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </CardContent>
      </Card>)}
    </div>
    {!data.tasks.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No current tasks to show.</p>}
  </div>;
}
