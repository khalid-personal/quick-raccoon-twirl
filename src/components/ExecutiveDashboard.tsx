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
import RecentOperations from './RecentOperations';
import { DASHBOARD_PALETTE } from '@/lib/dashboard-palette';
import ExecutiveKpiExplorer from './ExecutiveKpiExplorer';
import type { ExecutiveKpi } from '@/lib/executive-kpi';

const COLORS = {
  blue: DASHBOARD_PALETTE.teal,
  indigo: DASHBOARD_PALETTE.forest,
  emerald: DASHBOARD_PALETTE.sage,
  amber: DASHBOARD_PALETTE.amber,
  rose: DASHBOARD_PALETTE.rose,
  slate: DASHBOARD_PALETTE.slate,
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
  tone?: 'brand' | 'warning';
  sub?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  delta?: number;
  onInspect: () => void;
  action: string;
}

const Kpi: React.FC<KpiProps> = ({ label, value, icon: Icon, tone = 'brand', sub, spark, sparkColor = COLORS.blue, delta, onInspect, action }) => (
  <Card className="portal-kpi executive-interactive-kpi relative overflow-hidden">
    <button type="button" aria-label={`Explore ${label}`} aria-haspopup="dialog" onClick={onInspect} className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="portal-kpi-value font-semibold tabular-nums">{value}</p>
        </div>
        <div data-accent={tone === 'warning' ? 'amber' : undefined} className="portal-widget-icon rounded-xl p-2.5"><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center font-medium', delta >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}%
          </span>
        )}
        {sub}
      </div>
      {spark && (
        <div aria-hidden="true" className="pointer-events-none mt-2 h-10 -mx-1">
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
      <span className="executive-kpi-action mt-4 flex items-center justify-between gap-2 border-t pt-3 text-sm font-semibold text-primary">{action}<ArrowUpRight className="h-4 w-4" /></span>
    </button>
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
            <div key={f.stageTitle} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 xl:grid-cols-[125px_minmax(0,1fr)]">
              <div className="text-sm font-medium">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{f.ordinal}</span>
                {f.stageTitle}
              </div>
              <div className="relative col-span-2 h-9 rounded-md bg-muted/60 xl:col-span-1">
                <div
                  className="flex h-9 items-center justify-between rounded-md px-3 text-sm font-semibold text-white shadow-sm transition-all"
                  style={{ width: `${width}%`, background: `linear-gradient(90deg, ${COLORS.indigo}, ${COLORS.blue})` }}
                >
                  <span>{f.reached}</span>
                  {f.blocked > 0 && <span className="rounded bg-rose-500/90 px-1.5 py-0.5 text-[10px]">{f.blocked} failed</span>}
                </div>
              </div>
              <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
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
  const [metric, setMetric] = React.useState<ExecutiveKpi | null>(null);
  const { data: m, isLoading, refetch } = useQuery<ExecutiveMetrics>({
    queryKey: ['executiveMetrics', localAgencyName, localAgencyId],
    queryFn: () => api.getExecutiveMetrics(localAgencyName, undefined, localAgencyId),
  });
  React.useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener('supabase-data-changed', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('agency-resolution-changed', refresh);
    window.addEventListener('bank-statement-changed', refresh);
    return () => { window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('agency-resolution-changed', refresh); window.removeEventListener('bank-statement-changed', refresh); };
  }, [refetch]);

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
        <Kpi label="Total Candidates" value={t.candidates} icon={Users}
          onInspect={() => setMetric('candidates')} action="Explore roster & recent intake"
          delta={t.newPrev30 ? growth : undefined} sub={`${t.newLast30} new in 30 days`} spark={m.trend.map(x => x.registered)} sparkColor={COLORS.blue} />
        <Kpi label="Deployed" value={t.deployed} icon={PlaneTakeoff}
          onInspect={() => setMetric('deployed')} action="Inspect deployed journeys"
          sub={`${t.deploymentRate}% deployment rate`} spark={m.trend.map(x => x.deployed)} sparkColor={COLORS.emerald} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Average time to departure" value={t.deployed ? `${t.avgDaysToDeploy} days` : '—'} icon={Timer} sub="From registration to departure" onInspect={() => setMetric('departure')} action="Compare shortest & longest" />
        <Kpi label="Average time waiting" value={t.active ? `${t.avgDaysActive} days` : '—'} icon={Clock} tone="warning" sub="Since registration, for candidates not yet deployed" onInspect={() => setMetric('waiting')} action="Find longest waits & follow up" />
        <Kpi label="Unread Messages" value={t.unreadMessages} icon={MessageSquare} sub="From candidates" onInspect={() => setMetric('messages')} action="Review candidate conversations" />
      </div>
      {metric && <ExecutiveKpiExplorer key={`${metric}-${localAgencyId}-${localAgencyName}`} metric={metric} localAgencyId={localAgencyId} localAgencyName={localAgencyName} candidateBasePath={candidateBasePath} generatedAt={m.generatedAt} onClose={() => setMetric(null)} onMetricChange={setMetric} />}

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
        <Card className="overflow-hidden">
          <CardHeader className="portal-card-heading mb-4"><div className="flex items-center gap-3"><span className="portal-widget-icon rounded-2xl p-3"><HeartPulse className="h-6 w-6" /></span><div><CardTitle>Medical Results</CardTitle><CardDescription>{m.medical.total} exams recorded</CardDescription></div></div></CardHeader>
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

        <Card className="overflow-hidden">
          <CardHeader className="portal-card-heading mb-4"><div className="flex items-center gap-3"><span className="portal-widget-icon rounded-2xl p-3"><FileCheck2 className="h-6 w-6" /></span><div><CardTitle>Travel readiness</CardTitle><CardDescription>Contracts &amp; visas · uploads + external system</CardDescription></div></div></CardHeader>
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
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />{m.documents.totalFiles} supporting files stored</p>
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

      <Card className="overflow-hidden">
        <CardHeader className="portal-card-heading pb-4"><CardTitle className="flex items-center text-xl"><span className="portal-widget-icon mr-3 rounded-xl p-2"><Activity className="h-6 w-6" /></span>Recent Activity</CardTitle><CardDescription>Recorded actions, their authors and dates.</CardDescription></CardHeader>
        <CardContent className="space-y-4 pt-5">
          <RecentOperations activity={m.activity} localAgencyId={localAgencyId} paymentPath={`${candidateBasePath.startsWith('/local-agency') ? '/local-agency' : '/admin'}/payments${localAgencyId ? `?agency=${encodeURIComponent(localAgencyId)}` : ''}`} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboard;
