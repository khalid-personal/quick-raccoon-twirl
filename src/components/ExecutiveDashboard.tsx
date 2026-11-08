import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, FileCheck2, HeartPulse,
  Loader2, MessageSquare, PlaneTakeoff, ShieldAlert, Timer, Users, type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { ExecutiveMetrics } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import DashboardExplorer from './DashboardExplorer';
import type { DashboardSelection } from '@/lib/dashboard-drilldown';
import { CandidateWorkspaceLink } from './CandidateQuickViewProvider';
import { ALL_STAGES } from '@/lib/types';

const COLORS = {
  blue: '#2563eb',
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
};
const STATUS_COLORS: Record<string, string> = {
  Pending: COLORS.amber,
  'In Progress': COLORS.blue,
  Completed: COLORS.emerald,
  Blocked: COLORS.rose,
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
  fontSize: 12,
};

interface KpiProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
  sub?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  delta?: number;
}

const Kpi: React.FC<KpiProps> = ({ label, value, icon: Icon, tone, sub, spark, sparkColor = COLORS.blue, delta }) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        </div>
        <div className={cn('rounded-lg p-2', tone)}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center font-medium', delta >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(delta)}%
          </span>
        )}
        {sub}
      </div>
      {spark && (
        <div className="mt-2 h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`sp-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill={`url(#sp-${label})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);

const Empty: React.FC<{ text?: string }> = ({ text = 'No data yet' }) => (
  <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted-foreground">{text}</div>
);

const RankedBars: React.FC<{ title: string; data: Array<{ name: string; value: number }>; color: string }> = ({ title, data, color }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 && <Empty />}
        {data.map(d => (
          <div key={d.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate pr-2">{d.name}</span>
              <span className="font-medium tabular-nums">{d.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const PipelineFunnel: React.FC<{ m: ExecutiveMetrics }> = ({ m }) => {
  const top = Math.max(1, m.funnel[0]?.reached ?? 1);
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Deployment Pipeline</CardTitle>
        <CardDescription>How many candidates reached each stage, conversion from the previous stage, and average time spent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {m.funnel.map((f, i) => {
          const width = Math.max(6, (f.reached / top) * 100);
          const dropped = i > 0 ? m.funnel[i - 1].reached - f.reached : 0;
          return (
            <div key={f.stageTitle} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
              <div className="text-sm font-medium">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{f.ordinal}</span>
                {f.stageTitle}
              </div>
              <div className="relative h-9 rounded-md bg-muted/60">
                <div
                  className="flex h-9 items-center justify-between rounded-md px-3 text-sm font-semibold text-white shadow-sm transition-all"
                  style={{ width: `${width}%`, background: `linear-gradient(90deg, ${COLORS.indigo}, ${COLORS.blue})` }}
                >
                  <span>{f.reached}</span>
                  {f.blocked > 0 && <span className="rounded bg-rose-500/90 px-1.5 py-0.5 text-[10px]">{f.blocked} failed</span>}
                </div>
              </div>
              <div className="flex w-44 items-center justify-end gap-2 text-xs text-muted-foreground">
                {i > 0 && (
                  <Badge variant="outline" className={cn('font-medium', f.conversion >= 70 ? 'text-emerald-600' : f.conversion >= 40 ? 'text-amber-600' : 'text-rose-600')}>
                    {f.conversion}% conv.
                  </Badge>
                )}
                <span className="inline-flex items-center"><Clock className="mr-1 h-3 w-3" />{f.avgDays ? `${f.avgDays}d avg` : '—'}</span>
                {dropped > 0 && <span className="text-rose-600">−{dropped}</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const ExecutiveDashboard: React.FC<{ localAgencyName?: string; localAgencyId?: string; candidateBasePath?: string }> = ({ localAgencyName, localAgencyId, candidateBasePath = '/admin/candidate' }) => {
  const [selection, setSelection] = React.useState<DashboardSelection | null>(null);
  const { data: m, isLoading } = useQuery<ExecutiveMetrics>({
    queryKey: ['executiveMetrics', localAgencyName],
    queryFn: () => api.getExecutiveMetrics(localAgencyName),
  });

  if (isLoading || !m) {
    return <Card className="flex h-[300px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></Card>;
  }

  const { totals: t } = m;
  const growth = t.newPrev30 ? Math.round(((t.newLast30 - t.newPrev30) / t.newPrev30) * 100) : t.newLast30 ? 100 : 0;
  const statusTotal = m.status.reduce((s, x) => s + x.value, 0);
  const medicalData = [
    { name: 'Passed', value: m.medical.passed, color: COLORS.emerald },
    { name: 'Pending', value: m.medical.pending, color: COLORS.amber },
    { name: 'Failed', value: m.medical.failed, color: COLORS.rose },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Kpi label="Total Candidates" value={t.candidates} icon={Users} tone="bg-blue-500/10 text-blue-600"
          delta={growth} sub={`${t.newLast30} new in 30 days`} spark={m.trend.map(x => x.registered)} sparkColor={COLORS.blue} />
        <Kpi label="Deployed" value={t.deployed} icon={PlaneTakeoff} tone="bg-emerald-500/10 text-emerald-600"
          sub={`${t.deploymentRate}% deployment rate`} spark={m.trend.map(x => x.deployed)} sparkColor={COLORS.emerald} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Average time to departure" value={t.avgDaysToDeploy ? `${t.avgDaysToDeploy} days` : '—'} icon={Timer} tone="bg-sky-500/10 text-sky-600" sub="From registration to departure" />
        <Kpi label="Average time waiting" value={t.avgDaysActive ? `${t.avgDaysActive} days` : '—'} icon={Clock} tone="bg-amber-500/10 text-amber-600" sub="Since registration, for candidates not yet deployed" />
        <Kpi label="Unread Messages" value={t.unreadMessages} icon={MessageSquare} tone="bg-violet-500/10 text-violet-600" sub="From candidates" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PipelineFunnel m={m} />
        <Card>
          <CardHeader className="pb-0"><CardTitle>Candidate Status</CardTitle><CardDescription>Overall distribution</CardDescription></CardHeader>
          <CardContent>
            {statusTotal === 0 ? <Empty /> : (
              <>
                <div className="relative h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={m.status} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} strokeWidth={0}>
                        {m.status.map(s => <Cell key={s.name} fill={STATUS_COLORS[s.name]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Status</span>
                    <span className="text-xs text-muted-foreground">mix</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {m.status.map(s => (
                    <div key={s.name} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
                      <span className="flex items-center"><span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] }} />{s.name}</span>
                      <span className="font-medium tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>6-Month Movement</CardTitle><CardDescription>Registrations and deployments</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={m.trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="registered" name="Registered" stroke={COLORS.blue} strokeWidth={2.5} fill="url(#regFill)" />
                  <Bar dataKey="deployed" name="Deployed" fill={COLORS.emerald} radius={[4, 4, 0, 0]} barSize={18} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-5 text-xs text-muted-foreground">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.blue }} />Registered</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.emerald }} />Deployed</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-card to-card">
          <CardHeader className="pb-0"><div className="flex items-center gap-3"><span className="rounded-2xl bg-teal-500/15 p-3 text-teal-700 dark:text-teal-300"><HeartPulse className="h-6 w-6" /></span><div><CardTitle>Medical Results</CardTitle><CardDescription>{m.medical.total} exams recorded</CardDescription></div></div></CardHeader>
          <CardContent>
            {m.medical.total === 0 ? <Empty /> : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={medicalData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                      {medicalData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-indigo-500/5">
          <CardHeader><div className="flex items-center gap-3"><span className="rounded-2xl bg-violet-500/15 p-3 text-violet-700 dark:text-violet-300"><FileCheck2 className="h-6 w-6" /></span><div><CardTitle>Travel readiness</CardTitle><CardDescription>Contracts &amp; visas · uploads + external system</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Work contracts received', value: m.documents.contractCount, rate: m.documents.contractRate, color: COLORS.blue },
              { label: 'Visas issued', value: m.documents.visaCount, rate: m.documents.visaRate, color: COLORS.emerald },
            ].map(d => (
              <div key={d.label} className="flex items-center gap-4 rounded-2xl border bg-background/60 p-4">
                <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" role="img" aria-label={`${d.rate}% ${d.label}`}><circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" /><circle cx="32" cy="32" r="26" fill="none" stroke={d.color} strokeWidth="5" strokeLinecap="round" strokeDasharray={2*Math.PI*26} strokeDashoffset={2*Math.PI*26*(1-Math.min(100,Math.max(0,d.rate))/100)} transform="rotate(-90 32 32)" /><text x="32" y="34" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="12" fontWeight="700">{d.rate}%</text></svg>
                <div><p className="text-2xl font-bold tabular-nums">{d.value}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {t.candidates}</span></p><p className="text-sm font-semibold">{d.label}</p></div>
              </div>
            ))}
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-violet-500" />{m.documents.totalFiles} supporting files stored</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-rose-500/5">
          <CardHeader className="border-b border-amber-500/20 pb-4">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 text-xl"><ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-300" />Needs Attention</span>
              {m.needsAttentionTotal > 0 && <Badge variant="destructive">{m.needsAttentionTotal}</Badge>}
            </CardTitle>
            <CardDescription>Failed stages or no movement for 14+ days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {m.needsAttention.length === 0 && <Empty text="Everything is moving 🎉" />}
            {m.needsAttention.map(n => (
              <CandidateWorkspaceLink key={n.id} candidateId={n.id} tab="timeline" stageId={ALL_STAGES.find(stage => stage.title === n.stageTitle)?.id} to={`${candidateBasePath}/${n.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-background/60 p-4 text-sm transition-colors hover:border-amber-500/50 hover:bg-amber-500/10">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{n.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{n.trackingCode} · {n.stageTitle}</p><p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Open the stage to follow up →</p>
                </div>
                <Badge variant="outline" className={n.reason === 'Failed stage' ? 'text-rose-600' : 'text-amber-600'}>
                  {n.reason === 'Failed stage' ? 'Failed' : `${n.daysInStage}d`}
                </Badge>
              </CandidateWorkspaceLink>
            ))}
          </CardContent>
        </Card>
      </div>

      <DashboardExplorer localAgencyId={localAgencyId} candidateBasePath={candidateBasePath} selection={selection} onSelect={setSelection} onClose={() => setSelection(null)} />

      <Card className="overflow-hidden border-sky-500/25">
        <CardHeader className="border-b bg-gradient-to-r from-sky-500/10 to-transparent pb-4"><CardTitle className="flex items-center text-xl"><span className="mr-3 rounded-xl bg-sky-500/15 p-2 text-sky-700 dark:text-sky-300"><Activity className="h-6 w-6" /></span>Recent Activity</CardTitle><CardDescription>Recorded actions, their authors and dates.</CardDescription></CardHeader>
        <CardContent className="space-y-0 pt-5">
          {m.activity.length === 0 && <Empty text="No recorded activity yet" />}
          {m.activity.map(a => (
            <div key={a.id} className="relative ml-3 border-l-2 border-sky-500/20 pb-5 pl-7 text-sm last:pb-0">
              <span aria-hidden="true" className="absolute -left-[7px] top-2 h-3 w-3 rounded-full border-2 border-card bg-sky-500" />
              <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300">{a.action}</Badge><span className="text-xs text-muted-foreground">{a.actor} · {new Date(a.timestamp).toLocaleDateString()}</span></div>
              <div className="mt-2 rounded-xl bg-muted/30 p-3">
                <p className="break-words leading-relaxed">{a.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboard;
