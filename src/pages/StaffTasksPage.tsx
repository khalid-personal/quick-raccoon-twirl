import React, { useEffect, useMemo, useState } from 'react';
import { usePageMemory } from '@/hooks/use-page-memory';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, ListTodo, Loader2, Users, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/page/PageHeader';
import { getCandidateStages, getCandidates, getConfig, getLocalAgencies, getStaffUsers, getPayments, getPaymentStatuses } from '@/lib/data-store';
import { useAuth } from '@/lib/auth-context';
import { ALL_STAGES, type CandidateStage, type StaffUser } from '@/lib/types';
import { getActiveStageTasks } from '@/lib/staff-tasks';
import { assignCandidateStageTask, autoBalanceStaffTasks, prepareStaffTasks, rebalanceStaffTasks, updateStaffTaskWeights } from '@/lib/api/staff-work';
import CandidateAvatar from '@/components/CandidateAvatar';
import UserAvatar from '@/components/UserAvatar';

const todayKey = new Date().toISOString().slice(0, 10);
const DONE = new Set(['Passed', 'Issued', 'Completed']);
const NO_OWNER = 'unassigned';

const StaffTasksPage: React.FC = () => {
  const { user, userRole, viewAs } = useAuth();
  const effectiveUserId = viewAs?.userId ?? user?.id;
  const queryClient = useQueryClient();
  const isManager = userRole === 'superadmin' || userRole === 'admin';
  const canManage = userRole === 'superadmin';
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [assigneeFilter, setAssigneeFilter] = usePageMemory('assignee', 'all');
  const [localFilter, setLocalFilter] = usePageMemory('agency', 'all');
  const actor = { id: effectiveUserId ?? '', email: user?.email ?? '', role: userRole ?? '' };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['staff-workboard'],
    queryFn: async () => {
      await prepareStaffTasks(canManage);
      return { candidates: getCandidates(), stages: getCandidateStages(), staff: getStaffUsers(), locals: getLocalAgencies(), weights: getConfig().staffTaskWeights ?? {},
        paymentContext: { fees: getConfig().stageFees ?? {}, statuses: getPaymentStatuses(), payments: getPayments() } };
    },
    refetchInterval: 30000,
  });

  const savedWeightsKey = JSON.stringify(data?.weights ?? {});
  useEffect(() => {
    setWeights(JSON.parse(savedWeightsKey) as Record<string, number>);
  }, [savedWeightsKey]);

  const candidates = useMemo(() => (data?.candidates ?? []).filter(candidate => !isManager || localFilter === 'all' || candidate.local_agency_id === localFilter), [data?.candidates, isManager, localFilter]);
  const scopedIds = useMemo(() => new Set(candidates.map(candidate => candidate.id)), [candidates]);
  const stages = useMemo(() => (data?.stages ?? []).filter(stage => scopedIds.has(stage.candidate_id)), [data?.stages, scopedIds]);
  const allStaff = (data?.staff ?? []).filter(person => person.role === 'staff' && person.is_approved);
  const staff = allStaff.filter(person => localFilter === 'all' || person.local_agency_id === localFilter);
  const tasks = useMemo(() => getActiveStageTasks(candidates, stages, Date.now(), data?.paymentContext), [candidates, stages, data?.paymentContext]);
  const mine = tasks.filter(task => task.stage.assigned_staff_id === effectiveUserId);
  const visibleTasks = (isManager ? tasks : mine).filter(task => {
    if (!isManager || assigneeFilter === 'all') return true;
    return task.stage.assigned_staff_id === assigneeFilter;
  });
  const dailyTasks = isManager ? tasks : mine;
  const dueToday = dailyTasks.filter(task => task.dueAt.slice(0, 10) === todayKey && !task.overdue).length;
  const overdue = dailyTasks.filter(task => task.overdue).length;
  const completedToday = stages.filter(stage => (isManager || stage.assigned_staff_id === effectiveUserId) && DONE.has(stage.status) && stage.updated_at.slice(0, 10) === todayKey).length;
  const openTasks = isManager ? tasks.length : mine.length;
  const caughtUp = dueToday === 0 && overdue === 0;
  const progress = caughtUp ? 100 : Math.round((completedToday / Math.max(1, completedToday + dueToday + overdue)) * 100);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff-workboard'] });
  const automaticDistribution = useMutation({
    mutationFn: () => autoBalanceStaffTasks(actor),
    onSuccess: result => {
      if (result.unassigned) toast.warning(`${result.assigned} tasks assigned. ${result.unassigned} need eligible staff in their agency; paused staff were not activated.`);
      else toast.success(`${result.assigned} active tasks balanced across all agencies. ${result.changed} owners changed.`);
      void refresh();
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Could not balance work.'),
  });
  const applyDistribution = useMutation({
    mutationFn: async () => {
      await updateStaffTaskWeights(weights, actor);
      return rebalanceStaffTasks(weights, actor);
    },
    onSuccess: count => {
      toast.success(`Workload settings saved. ${count} active stage tasks are assigned.`);
      void refresh();
    },
    onError: error => toast.error((error as Error).message),
  });
  const assignTask = useMutation({
    mutationFn: ({ candidateId, stageId, staffId }: { candidateId: string; stageId: number; staffId: string }) =>
      assignCandidateStageTask(candidateId, stageId, staffId, actor),
    onSuccess: () => { toast.success('Task assignment updated.'); void refresh(); },
    onError: error => toast.error((error as Error).message),
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (isError) return <p role="alert" className="text-destructive">Could not load today’s work. Refresh and try again.</p>;

  const taskProgress = (task: typeof tasks[number]) => {
    const ownStages = stages.filter(stage => stage.candidate_id === task.candidate.id);
    const completed = ownStages.filter(stage => DONE.has(stage.status)).length;
    return { completed, total: Math.max(ALL_STAGES.length, ownStages.length), percent: Math.round(completed / Math.max(ALL_STAGES.length, ownStages.length) * 100) };
  };
  const staffName = (id?: string) => allStaff.find(person => person.id === id)?.email ?? 'Unassigned';
  const formatDue = (dueAt: string) => new Date(dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        title={isManager ? 'Staff Workboard' : 'My Daily Work'}
        description={isManager ? 'Balance candidate follow-ups and stage work across the team.' : 'Your assigned candidate follow-ups and stage actions, ordered by due date.'}
        actions={isManager ? <div className="flex flex-wrap items-center gap-2">
          <Select value={localFilter} onValueChange={value => { setLocalFilter(value); setAssigneeFilter('all'); }}>
            <SelectTrigger aria-label="Filter tasks by local agency" className="w-56"><SelectValue placeholder="Local agency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All local agencies</SelectItem>
              {(data?.locals ?? []).map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && <Button onClick={() => applyDistribution.mutate()} disabled={applyDistribution.isPending || automaticDistribution.isPending || allStaff.length === 0}>{applyDistribution.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}Apply workload settings</Button>}
        </div> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{isManager ? 'Open team tasks' : 'My open tasks'}</p><p className="text-2xl font-semibold tabular-nums">{openTasks}</p></div><ListTodo className="h-5 w-5 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Due today</p><p className="text-2xl font-semibold tabular-nums">{dueToday}</p></div><Clock3 className="h-5 w-5 text-amber-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Overdue</p><p className="text-2xl font-semibold tabular-nums">{overdue}</p></div><AlertTriangle className="h-5 w-5 text-rose-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Completed today</p><p className="text-2xl font-semibold tabular-nums">{completedToday}</p></div><CheckCircle2 className="h-5 w-5 text-emerald-600" /></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Today’s progress</CardTitle>
            <Badge variant={caughtUp ? 'default' : overdue ? 'destructive' : 'outline'}>{caughtUp ? 'Caught up' : overdue ? 'Overdue work' : 'In progress'}</Badge>
          </div>
          <CardDescription>{caughtUp ? 'All tasks due today are complete.' : `${completedToday} completed of ${completedToday + dueToday + overdue} due or overdue tasks.`}</CardDescription>
        </CardHeader>
        <CardContent><Progress value={progress} aria-label="Daily task progress" className="h-2.5" /></CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl"><CardTitle className="text-base">Workload balance</CardTitle>
            <CardDescription>Auto-balance assigns equal shares across all agencies, even if this view is filtered. Paused staff (weight 0) stay paused. Completed stages and payment status never change. Use custom weights below when needed.</CardDescription></div>
            {canManage && <Button onClick={() => automaticDistribution.mutate()} disabled={automaticDistribution.isPending || applyDistribution.isPending || !allStaff.length}>{automaticDistribution.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}Auto-populate & balance all</Button>}
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staff.length === 0 ? <p className="text-sm text-muted-foreground">No approved staff accounts are available for assignment.</p> : staff.map(person => (
              <div key={person.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex min-w-0 items-center gap-2"><UserAvatar user={person} /><div className="min-w-0"><p className="truncate text-sm font-medium">{person.email}</p><p className="text-xs text-muted-foreground">{tasks.filter(task => task.stage.assigned_staff_id === person.id).length} open tasks</p></div></div>
                <Label className="flex items-center gap-2 text-xs">Load
                  <Input type="number" min="0" max="5" step="0.25" disabled={!canManage || automaticDistribution.isPending} className="w-20" value={weights[person.id] ?? 1} onChange={event => setWeights(current => ({ ...current, [person.id]: Number(event.target.value) }))} aria-label={`Workload weight for ${person.email}`} />
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="text-base">{isManager ? 'Active candidate tasks' : 'My assigned tasks'}</CardTitle><CardDescription>Opening a candidate lets you update the current stage and record follow-up notes.</CardDescription></div>
          {isManager && <Select value={assigneeFilter} onValueChange={setAssigneeFilter}><SelectTrigger className="w-52"><SelectValue placeholder="Filter by staff" /></SelectTrigger><SelectContent><SelectItem value="all">All staff</SelectItem>{staff.map(person => <SelectItem key={person.id} value={person.id}>{person.email}</SelectItem>)}</SelectContent></Select>}
        </CardHeader>
        <CardContent className="p-0">
          {visibleTasks.length === 0 ? <div className="space-y-2 p-8 text-center"><p className="font-medium">{isManager ? 'No active stage tasks.' : caughtUp ? 'You are caught up.' : 'No tasks are assigned to you yet.'}</p><p className="text-sm text-muted-foreground">{isManager ? 'New tasks appear when a candidate reaches an unfinished stage.' : 'Ask your administrator to distribute unassigned work.'}</p></div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Next action</TableHead><TableHead>Stage progress</TableHead><TableHead>Due</TableHead><TableHead>Assigned to</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visibleTasks.map(task => {
                    const progress = taskProgress(task);
                    return (
                      <TableRow key={`${task.candidate.id}:${task.stage.stage_id}`}>
                        <TableCell><div className="flex items-center gap-2"><CandidateAvatar candidate={task.candidate} className="h-9 w-9" /><div><Link to={`/admin/candidate/${task.candidate.id}`} className="font-medium hover:text-primary hover:underline">{task.candidate.first_name} {task.candidate.last_name}</Link><p className="font-mono text-xs text-muted-foreground">{task.candidate.tracking_code}</p></div></div></TableCell>
                        <TableCell><p className="font-medium">{task.action}</p><p className="text-xs text-muted-foreground">{task.stageTitle}{task.stage.follow_up_note ? ` · ${task.stage.follow_up_note}` : ''}</p></TableCell>
                        <TableCell><div className="min-w-28 space-y-1"><p className="text-xs">{progress.completed} / {progress.total}</p><Progress value={progress.percent} className="h-1.5" /></div></TableCell>
                        <TableCell><Badge variant={task.overdue ? 'destructive' : task.dueAt.slice(0, 10) === todayKey ? 'secondary' : 'outline'}>{task.overdue ? 'Overdue' : formatDue(task.dueAt)}</Badge></TableCell>
                        <TableCell>{canManage ? <Select value={task.stage.assigned_staff_id ?? NO_OWNER} onValueChange={value => value !== NO_OWNER && assignTask.mutate({ candidateId: task.candidate.id, stageId: task.stage.stage_id, staffId: value })}><SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_OWNER}>Unassigned</SelectItem>{allStaff.filter(person => !person.local_agency_id || person.local_agency_id === task.candidate.local_agency_id).map(person => <SelectItem key={person.id} value={person.id}>{person.email}</SelectItem>)}</SelectContent></Select> : staffName(task.stage.assigned_staff_id)}</TableCell>
                        <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link to={`/admin/candidate/${task.candidate.id}?tab=timeline&stage=${task.stage.stage_id}`}>Work <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffTasksPage;
