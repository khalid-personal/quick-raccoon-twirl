import React, { useMemo } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BriefcaseBusiness, PlaneTakeoff, Users2 } from 'lucide-react';
import { LIFECYCLE, LIFECYCLE_COLOR, TENURE_BUCKETS, ageOf, classifyLifecycle, tally, tenureBucket } from '@/lib/portfolio';
import { usePortalData } from '@/hooks/use-portal-data';
import WidgetShell from './WidgetShell';

const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 };

const useScoped = (localAgencyId?: string) => {
  const { candidates, stages } = usePortalData();
  return useMemo(() => {
    const scoped = candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId);
    const byCandidate = new Map<string, typeof stages>();
    stages.forEach(stage => byCandidate.set(stage.candidate_id, [...(byCandidate.get(stage.candidate_id) ?? []), stage]));
    return scoped.map(candidate => ({ candidate, phase: classifyLifecycle(candidate, byCandidate.get(candidate.id) ?? []) }));
  }, [candidates, stages, localAgencyId]);
};

const Bars: React.FC<{ data: Array<{ name: string; value: number }>; color: string; limit?: number }> = ({ data, color, limit = 6 }) => {
  const rows = data.slice(0, limit);
  const max = Math.max(1, ...rows.map(row => row.value));
  return (
    <div className="space-y-2.5">
      {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>}
      {rows.map(row => (
        <div key={row.name} className="space-y-1">
          <div className="flex justify-between text-sm"><span className="truncate pr-2">{row.name}</span><span className="tabular-nums text-muted-foreground">{row.value}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
};

export const PortfolioLifecycle: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const items = useScoped(localAgencyId);
  const counts = LIFECYCLE.map(name => ({ name, value: items.filter(item => item.phase === name).length }));
  return (
    <WidgetShell title="Candidate lifecycle" description="Where every candidate is today, from registration to working abroad and back home" icon={Users2} accent="violet" className="h-full">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-[190px] w-[190px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={counts.filter(item => item.value)} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
                {counts.filter(item => item.value).map(item => <Cell key={item.name} fill={LIFECYCLE_COLOR[item.name]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold tabular-nums">{items.length}</span><span className="text-xs text-muted-foreground">candidates</span></div>
        </div>
        <ul className="grid w-full flex-1 gap-2 text-sm">
          {counts.map(item => (
            <li key={item.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LIFECYCLE_COLOR[item.name] }} />{item.name}</span>
              <span className="font-semibold tabular-nums">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
};

export const PortfolioWorkforce: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const items = useScoped(localAgencyId);
  const working = items.filter(item => item.phase === 'Working abroad');
  const buckets = TENURE_BUCKETS.map(name => ({ name, value: working.filter(item => tenureBucket(item.candidate.arrival!.arrived_at) === name).length }));
  const avgMonths = working.length ? working.reduce((sum, item) => sum + (Date.now() - Date.parse(item.candidate.arrival!.arrived_at)) / 86_400_000 / 30.44, 0) / working.length : 0;
  const countries = tally(working, item => item.candidate.external_status?.destination_country);
  return (
    <WidgetShell title="Working abroad" description="Candidates already employed, by time on the job and country" icon={PlaneTakeoff} accent="emerald" className="h-full" bodyClassName="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[['Working now', String(working.length)], ['Avg. tenure', `${avgMonths.toFixed(1)} mo`], ['Countries', String(countries.length)]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-emerald-500/5 p-3"><p className="text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{value}</p><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p></div>
        ))}
      </div>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} tickFormatter={value => value.replace(' months', ' mo').replace('Under ', '<').replace('Over ', '>')} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / .5)' }} />
            <Bar dataKey="value" name="Candidates" radius={[6, 6, 0, 0]} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Bars data={countries} color="#10b981" limit={4} />
    </WidgetShell>
  );
};

export const PortfolioMix: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const items = useScoped(localAgencyId);
  const females = items.filter(item => item.candidate.gender === 'female').length;
  const ages = tally(items, item => { const age = ageOf(item.candidate.dob); return age < 25 ? '18 to 24' : age < 30 ? '25 to 29' : age < 35 ? '30 to 34' : '35 and over'; });
  return (
    <WidgetShell title="Portfolio mix" description="Occupations, gender and age across the portfolio" icon={BriefcaseBusiness} accent="sky" className="h-full" bodyClassName="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Occupations</p>
        <Bars data={tally(items, item => item.candidate.occupation)} color="#0ea5e9" limit={6} />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gender</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted"><div className="bg-pink-400" style={{ width: `${items.length ? (females / items.length) * 100 : 0}%` }} /><div className="flex-1 bg-sky-500" /></div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span>Women {females}</span><span>Men {items.length - females}</span></div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Age</p>
        <Bars data={ages.sort((a, b) => a.name.localeCompare(b.name))} color="#6366f1" />
      </div>
    </WidgetShell>
  );
};
