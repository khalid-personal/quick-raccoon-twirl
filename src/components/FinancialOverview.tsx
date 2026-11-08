import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Banknote, Globe2, Landmark, ShieldAlert, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { analyzeAgencyPayments } from '@/lib/agency-payments';
import { isForeignPayment, toUsd } from '@/lib/currency';
import { usePortalData } from '@/hooks/use-portal-data';
import type { PaymentAnalytics } from '@/lib/types';
import { cn } from '@/lib/utils';
import WidgetShell from './WidgetShell';

const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const full = (n: number) => Math.round(n).toLocaleString('en-US');
const STAGE_COLORS = ['#6366f1', '#38bdf8', '#10b981', '#f59e0b', '#f43f5e'];
const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, boxShadow: '0 12px 32px rgba(15,23,42,.14)' };

const Ring: React.FC<{ percent: number }> = ({ percent }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" role="img" aria-label={`${percent}% collected`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, percent) / 100)} className="transition-[stroke-dashoffset] duration-1000" />
      <text x="40" y="40" transform="rotate(90 40 40)" textAnchor="middle" dominantBaseline="central" className="fill-white text-[16px] font-semibold">{percent}%</text>
    </svg>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode; tone: string }> = ({ label, value, sub, icon, tone }) => (
  <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-3">
    <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>{icon}</span>
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

const FinancialOverview: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const { payments, candidates, stages, locals } = usePortalData();
  const localName = locals.find(agency => agency.id === localAgencyId)?.name;
  const { data: fees } = useQuery<PaymentAnalytics>({
    queryKey: ['financeFees', localName],
    queryFn: () => api.getPaymentAnalytics('All', undefined, localName),
    initialData: { totalFeesDue: 0, totalFeesPaid: 0, stages: [] },
  });

  const model = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: date.toLocaleString('en-US', { month: 'short' }), fees: 0, foreign: 0 };
    });
    const scoped = payments.filter(payment => payment.status === 'succeeded' && (!localAgencyId || payment.payee_local_agency_id === localAgencyId));
    const methods = new Map<string, number>();
    const byStage = new Map<number, number>();
    scoped.forEach(payment => {
      const month = months.find(item => item.key === payment.created_at.slice(0, 7));
      if (isForeignPayment(payment)) {
        if (month) month.foreign += Math.round(toUsd(payment.amount, payment.currency) ?? 0);
        return;
      }
      if (month) month.fees += payment.amount;
      methods.set(payment.payment_method ?? 'Other', (methods.get(payment.payment_method ?? 'Other') ?? 0) + payment.amount);
      if (payment.stage_id) byStage.set(payment.stage_id, (byStage.get(payment.stage_id) ?? 0) + payment.amount);
    });
    const last = months[11].fees;
    const before = months[10].fees;
    return {
      months,
      methods: [...methods.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      stages: [...byStage.entries()].sort((a, b) => a[0] - b[0]).map(([id, value]) => ({ name: ['Registration', 'Medical', 'Training', 'Deployment'][id - 1] ?? `Stage ${id}`, value })),
      delta: before > 0 ? Math.round(((last - before) / before) * 100) : undefined,
      foreignUsd: months.reduce((sum, item) => sum + item.foreign, 0),
    };
  }, [payments, localAgencyId]);

  const recon = useMemo(() => analyzeAgencyPayments(candidates, payments, stages, Date.now(), localAgencyId), [candidates, payments, stages, localAgencyId]);
  const collected = fees.totalFeesPaid;
  const due = fees.totalFeesDue;
  const rate = due > 0 ? Math.round((collected / due) * 100) : 0;
  const methodTotal = Math.max(1, model.methods.reduce((sum, item) => sum + item.value, 0));

  return (
    <WidgetShell title="Financial overview" description="Candidate fees in ETB, foreign agency receipts in USD equivalent, and settlement health" icon={Wallet} accent="indigo" className="h-full" bodyClassName="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/70">Candidate fees collected</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">ETB {full(collected)}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-white/80">
                {model.delta !== undefined && (
                  <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
                    {model.delta >= 0 ? <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}{Math.abs(model.delta)}% vs last month
                  </span>
                )}
                of ETB {full(due)} due
              </p>
            </div>
            <Ring percent={rate} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Stat label="Outstanding fees" value={`ETB ${compact(Math.max(0, due - collected))}`} sub={`${100 - rate}% of fees due`} icon={<Banknote className="h-5 w-5" />} tone="bg-amber-500/10 text-amber-600" />
          <Stat label="Foreign receipts" value={`$${compact(model.foreignUsd)}`} sub="Last 12 months, USD eq." icon={<Globe2 className="h-5 w-5" />} tone="bg-emerald-500/10 text-emerald-600" />
          <Stat label="Discrepancies" value={String(recon.flagged)} sub={`of ${recon.contracts} contracts`} icon={<ShieldAlert className="h-5 w-5" />} tone={recon.flagged ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'} />
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Monthly inflow</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Candidate fees (ETB)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Foreign receipts (USD)</span>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={model.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fin-fees" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 6" className="stroke-border" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis yAxisId="etb" tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={compact} />
              <YAxis yAxisId="usd" orientation="right" tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={value => `$${compact(value)}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => name === 'Foreign receipts' ? [`$${full(value)}`, name] : [`ETB ${full(value)}`, name]} />
              <Area yAxisId="etb" type="monotone" dataKey="fees" name="Candidate fees" stroke="#6366f1" strokeWidth={2.5} fill="url(#fin-fees)" />
              <Line yAxisId="usd" type="monotone" dataKey="foreign" name="Foreign receipts" stroke="#10b981" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <p className="mb-1 text-sm font-semibold">Fees by stage</p>
          {model.stages.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No fee payments yet.</p> : (
            <div className="flex items-center gap-4">
              <div className="h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={model.stages} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none">
                      {model.stages.map((_, index) => <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `ETB ${full(value)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {model.stages.map((item, index) => (
                  <li key={item.name} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLORS[index % STAGE_COLORS.length] }} />{item.name}</span><span className="tabular-nums text-muted-foreground">{compact(item.value)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="rounded-2xl border p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-muted-foreground" />Payment channels</p>
          <div className="space-y-3">
            {model.methods.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>}
            {model.methods.map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{item.name}</span><span className="tabular-nums text-muted-foreground">ETB {compact(item.value)} · {Math.round((item.value / methodTotal) * 100)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(item.value / methodTotal) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WidgetShell>
  );
};

export default FinancialOverview;
