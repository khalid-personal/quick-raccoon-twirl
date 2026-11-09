import { useState } from 'react';
import { ArrowUpRight, Clock, Search, Users } from 'lucide-react';
import { usePortalData } from '@/hooks/use-portal-data';
import { getChatMessages } from '@/lib/data-store';
import { ALL_STAGES } from '@/lib/types';
import { EXECUTIVE_KPI_LABELS, executiveKpiRows, selectExecutiveKpiRows, type ExecutiveKpi } from '@/lib/executive-kpi';
import { candidateCity } from '@/lib/dashboard-drilldown';
import { practiceRecordLabel } from '@/lib/practice-record-label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CandidateWorkspaceLink } from './CandidateQuickViewProvider';
import CandidateAvatar from './CandidateAvatar';

const descriptions: Record<ExecutiveKpi, string> = {
  candidates: 'Explore the registered workforce. Switch between the full roster and recent registration windows.',
  deployed: 'Inspect completed stage journeys and their recorded departure dates. Stage completion is not proof of official ministry clearance.',
  departure: 'See the individual registration-to-departure durations behind the average. Choose a duration band or sort by longest journey.',
  waiting: 'Find the candidates still waiting, compare registration ages and open the next stage for follow-up. Waiting age is not an overdue deadline.',
  messages: 'Unread candidate messages, grouped by candidate. Opening this list does not mark messages read; open the conversation to review them.',
};
type Lens = 'all' | 'recent' | 'previous' | 'short' | 'middle' | 'long';

export default function ExecutiveKpiExplorer({ metric, localAgencyId, localAgencyName, candidateBasePath, generatedAt, onClose, onMetricChange }: {
  metric: ExecutiveKpi; localAgencyId?: string; localAgencyName?: string; candidateBasePath: string; generatedAt: string; onClose: () => void; onMetricChange?: (metric: ExecutiveKpi) => void;
}) {
  const { candidates, stages, locals } = usePortalData();
  const [lens, setLens] = useState<Lens>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'priority' | 'name'>('priority');
  const [page, setPage] = useState(0);
  const scopeId = localAgencyId || (localAgencyName ? locals.find(agency => agency.name === localAgencyName)?.id : undefined);
  const scoped = candidates.filter(candidate => !(localAgencyId || localAgencyName) || !!scopeId && candidate.local_agency_id === scopeId);
  const all = executiveKpiRows(scoped, stages, getChatMessages(), Date.parse(generatedAt));
  const cohort = selectExecutiveKpiRows(all, metric);
  const timing = metric === 'departure' || metric === 'waiting';
  const duration = (row: typeof cohort[number]) => metric === 'departure' || metric === 'deployed' ? row.departureDays ?? NaN : row.registrationAge;
  const lenses: { id: Lens; label: string }[] = metric === 'candidates'
    ? [{ id: 'all', label: 'All candidates' }, { id: 'recent', label: 'New · last 30 days' }, { id: 'previous', label: 'Previous 30 days' }]
    : timing ? [{ id: 'all', label: 'All durations' }, { id: 'short', label: 'Under 30 days' }, { id: 'middle', label: '30–89 days' }, { id: 'long', label: '90+ days' }]
      : [{ id: 'all', label: metric === 'messages' ? 'Unread conversations' : 'All deployed' }];
  const inLens = (row: typeof cohort[number], value: Lens) => {
    if (value === 'recent') return row.registrationAge >= 0 && row.registrationAge <= 30;
    if (value === 'previous') return row.registrationAge > 30 && row.registrationAge <= 60;
    const days = duration(row);
    if (value === 'short') return days >= 0 && days < 30;
    if (value === 'middle') return days >= 30 && days < 90;
    if (value === 'long') return days >= 90;
    return true;
  };
  const filtered = cohort.filter(row => inLens(row, lens) && `${row.candidate.first_name} ${row.candidate.last_name} ${row.candidate.tracking_code} ${candidateCity(row.candidate)}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.candidate.first_name.localeCompare(b.candidate.first_name) || a.candidate.last_name.localeCompare(b.candidate.last_name)
      : metric === 'messages' ? b.unread - a.unread
        : timing ? (Number.isFinite(duration(b)) ? duration(b) : -1) - (Number.isFinite(duration(a)) ? duration(a) : -1)
          : Date.parse(b.departureAt || b.candidate.created_at) - Date.parse(a.departureAt || a.candidate.created_at));
  const durations = cohort.map(duration).filter(Number.isFinite);
  const average = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  const unread = cohort.reduce((sum, row) => sum + row.unread, 0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader><DialogTitle>{EXECUTIVE_KPI_LABELS[metric]} · record breakdown</DialogTitle><DialogDescription>{descriptions[metric]}</DialogDescription></DialogHeader>
      {onMetricChange && <div role="group" aria-label="Explore another metric" className="flex flex-wrap gap-2">{(Object.keys(EXECUTIVE_KPI_LABELS) as ExecutiveKpi[]).map(value => <Button key={value} size="sm" variant={metric === value ? 'default' : 'outline'} aria-pressed={metric === value} onClick={() => onMetricChange(value)}>{EXECUTIVE_KPI_LABELS[value]}</Button>)}</div>}
      <section className="executive-metric-display rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest">{localAgencyId || localAgencyName ? locals.find(agency => agency.id === scopeId)?.name || 'Selected agency' : 'All local agencies'} · recorded journeys</p>
        <div className="mt-3 flex flex-wrap items-end gap-5">
          <div><strong className="text-4xl tabular-nums">{timing ? average === null ? '—' : `${average} days` : metric === 'messages' ? unread : cohort.length}</strong><p className="mt-1 text-sm">{timing ? 'Average across this metric’s candidates' : metric === 'messages' ? `${cohort.length} candidates with unread messages` : 'Candidate records in this metric'}</p></div>
          {timing && <div className="flex gap-5 text-sm"><div><strong className="block text-xl">{durations.length ? Math.floor(Math.min(...durations)) : '—'}</strong>Shortest · days</div><div><strong className="block text-xl">{durations.length ? Math.floor(Math.max(...durations)) : '—'}</strong>Longest · days</div></div>}
        </div>
      </section>
      <div role="group" aria-label="Metric cohort filters" className="grid gap-2 sm:grid-cols-3">{lenses.map(item => <button key={item.id} type="button" aria-pressed={lens === item.id} onClick={() => { setLens(item.id); setPage(0); }} className="executive-metric-lens rounded-xl border p-3 text-left"><span className="block text-sm font-semibold">{item.label}</span><strong className="text-2xl">{cohort.filter(row => inLens(row, item.id)).length}</strong><span className="ml-2 text-xs text-muted-foreground">candidates</span></button>)}</div>
      <div className="flex flex-wrap items-center gap-2"><Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><Input className="min-w-0 flex-1" aria-label="Search metric candidates" placeholder="Name, tracking code or city" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /><Button variant="outline" aria-pressed={sort === 'name'} onClick={() => { setSort(value => value === 'name' ? 'priority' : 'name'); setPage(0); }}>{sort === 'name' ? 'Sort: name' : timing ? 'Sort: longest first' : metric === 'messages' ? 'Sort: most unread' : 'Sort: newest first'}</Button></div>
      <div aria-live="polite" className="space-y-3">
        <p className="text-xs text-muted-foreground">{filtered.length} matching candidates · {cohort.length} in this metric</p>
        {filtered.slice(currentPage * 6, currentPage * 6 + 6).map(row => <article key={row.candidate.id} className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3"><CandidateAvatar candidate={row.candidate} className="h-11 w-11 shrink-0" /><div className="min-w-0 flex-1"><h3 className="font-semibold">{row.candidate.first_name} {row.candidate.last_name}</h3><p className="break-words font-mono text-xs text-muted-foreground">{row.candidate.tracking_code} · {candidateCity(row.candidate)}</p></div><span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">{metric === 'messages' ? `${row.unread} unread` : Number.isFinite(duration(row)) ? `${Math.floor(duration(row))} days` : 'No date'}</span></div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4 shrink-0" />{row.deployed ? `Recorded departure: ${row.departureAt?.slice(0, 10) || 'Date unavailable'}` : `Registered: ${row.candidate.created_at.slice(0, 10)} · ${ALL_STAGES.find(stage => stage.id === row.stage?.stage_id)?.title || 'Registration'} follow-up`}</p>
          {metric === 'messages' && <p className="mt-2 break-words rounded-lg border bg-card p-3 text-sm">{practiceRecordLabel(row.latestUnread?.message, row.candidate.id.startsWith('demo-'))}</p>}
          <Button asChild size="sm" variant="outline" className="mt-3"><CandidateWorkspaceLink candidateId={row.candidate.id} to={`${candidateBasePath}/${row.candidate.id}`} tab={metric === 'messages' ? 'chat' : metric === 'waiting' ? 'timeline' : 'profile'} stageId={metric === 'waiting' ? row.stage?.stage_id : undefined} onClick={onClose}>{metric === 'messages' ? 'Open conversation' : metric === 'waiting' ? 'Open next follow-up' : 'Open candidate'}<ArrowUpRight className="h-4 w-4" /></CandidateWorkspaceLink></Button>
        </article>)}
        {!filtered.length && <div className="rounded-xl border border-dashed p-6 text-center"><Users className="mx-auto mb-2 h-6 w-6 text-primary" /><p className="font-semibold">{metric === 'messages' && !cohort.length ? 'No unread candidate messages' : 'No candidates match this view'}</p><p className="mt-1 text-sm text-muted-foreground">{metric === 'messages' ? 'This does not mean no conversations exist. Candidate profiles still provide their chat history.' : 'Try another cohort or clear your search. No records are changed by these filters.'}</p>{(search || lens !== 'all') && <Button variant="ghost" onClick={() => { setSearch(''); setLens('all'); setPage(0); }}>Reset filters</Button>}</div>}
        <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-xs text-muted-foreground">{filtered.length ? `${currentPage * 6 + 1}–${Math.min(filtered.length, currentPage * 6 + 6)} of ${filtered.length}` : '0 candidates'}</span><Button variant="outline" disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next candidates</Button></div>
      </div>
      <p className="text-xs text-muted-foreground">Read-only exploration. Registration ages and stage dates are recorded timestamps, not an official clearance decision. Filters never move a candidate, assign work or mark messages read.</p>
    </DialogContent>
  </Dialog>;
}
