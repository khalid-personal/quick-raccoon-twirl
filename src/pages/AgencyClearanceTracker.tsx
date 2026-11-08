import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, Clock, Hourglass, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getCandidates } from '@/lib/data-store';
import { clearanceBlockers, isCleared, isVisaValid } from '@/lib/ksa-visa';
import type { Candidate } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import StatCards from '@/components/page/StatCards';
import FilterBar from '@/components/page/FilterBar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import CandidateAvatar from '@/components/CandidateAvatar';

type StepState = 'done' | 'rejected' | 'pending' | 'waiting';

const stepsOf = (c: Candidate): Array<{ key: string; title: string; state: StepState; detail?: string }> => {
  const visaState: StepState = isVisaValid(c) ? 'done' : c.visa?.status === 'pending' ? 'pending' : c.visa ? 'rejected' : 'waiting';
  const stepState = (s?: { status: string }): StepState => (s?.status === 'completed' ? 'done' : s?.status === 'rejected' ? 'rejected' : s ? 'pending' : 'waiting');
  const ministryStatus = c.clearance?.labour_ministry?.status;
  return [
    { key: 'visa', title: 'Visa validated', state: visaState, detail: c.visa?.visa_number },
    { key: 'enjaz', title: 'Enjaz', state: stepState(c.clearance?.enjaz), detail: c.clearance?.enjaz?.reference },
    { key: 'tasheer', title: 'Tasheer', state: stepState(c.clearance?.tasheer), detail: c.clearance?.tasheer?.reference },
    { key: 'cleared', title: 'Labour Ministry certificate issued', state: isCleared(c) ? 'done' : ministryStatus === 'rejected' || ministryStatus === 'error' ? 'rejected' : c.clearance?.local_ready_at ? 'pending' : 'waiting', detail: c.clearance?.labour_ministry?.certificate_no ?? c.clearance?.labour_ministry?.message ?? (c.clearance?.local_ready_at ? 'Awaiting ministry QR' : undefined) },
  ];
};

const STYLE: Record<StepState, { dot: string; text: string; Icon: React.ElementType }> = {
  done: { dot: 'border-emerald-500 bg-emerald-500 text-white', text: 'text-emerald-700 dark:text-emerald-300', Icon: Check },
  rejected: { dot: 'border-red-500 bg-red-500 text-white', text: 'text-red-700 dark:text-red-300', Icon: X },
  pending: { dot: 'border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', Icon: Clock },
  waiting: { dot: 'border-muted-foreground/30 bg-muted text-muted-foreground', text: 'text-muted-foreground', Icon: Hourglass },
};

// Clearance counts as started once the local agency has recorded anything against the candidate.
const isActivated = (c: Candidate) => !!(c.visa || c.clearance?.enjaz || c.clearance?.tasheer || c.clearance?.local_ready_at || c.clearance?.certificate_no);

const AgencyClearanceTracker: React.FC = () => {
  const { userForeignAgencyId, userForeignAgencyName } = useAuth();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'awaiting-local' | 'in-clearance' | 'awaiting-ministry' | 'action-required' | 'cleared'>('all');

  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener('supabase-data-changed', bump);
    const timer = window.setInterval(bump, 15000);
    return () => { window.removeEventListener('supabase-data-changed', bump); window.clearInterval(timer); };
  }, []);

  const mine = useMemo(
    () => getCandidates().filter(c => !!userForeignAgencyId && (c.foreign_agency_id === userForeignAgencyId
      || c.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId))),
    [userForeignAgencyId, version],
  );
  const active = mine.filter(isActivated);
  const query = search.trim().toLowerCase();
  const filtered = mine.filter(candidate => {
    if (filter === 'awaiting-local' && isActivated(candidate)) return false;
    if (filter === 'in-clearance' && (!isActivated(candidate) || isCleared(candidate))) return false;
    if (filter === 'awaiting-ministry' && (!candidate.clearance?.local_ready_at || isCleared(candidate))) return false;
    if (filter === 'action-required' && candidate.clearance?.labour_ministry?.status !== 'rejected' && candidate.clearance?.labour_ministry?.status !== 'error') return false;
    if (filter === 'cleared' && !isCleared(candidate)) return false;
    return true;
  });
  const rows = filtered.filter(c => !query || `${c.first_name} ${c.last_name} ${c.tracking_code}`.toLowerCase().includes(query));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance Tracker"
        description={`Follow ${userForeignAgencyName ?? 'your'} candidates through visa validation, Enjaz and Tasheer. The local agency runs each check and it appears here as soon as it starts.`}
      />
      <StatCards items={[
        { label: 'Your candidates', value: mine.length, icon: <ShieldCheck className="h-4 w-4" />, onClick: () => setFilter('all'), active: filter === 'all' },
        { label: 'Awaiting local agency', value: mine.length - active.length, icon: <Hourglass className="h-4 w-4" />, onClick: () => setFilter(filter === 'awaiting-local' ? 'all' : 'awaiting-local'), active: filter === 'awaiting-local' },
        { label: 'In clearance', value: active.filter(c => !isCleared(c)).length, icon: <Clock className="h-4 w-4" />, onClick: () => setFilter(filter === 'in-clearance' ? 'all' : 'in-clearance'), active: filter === 'in-clearance' },
        { label: 'Cleared', value: active.filter(isCleared).length, icon: <BadgeCheck className="h-4 w-4" />, onClick: () => setFilter(filter === 'cleared' ? 'all' : 'cleared'), active: filter === 'cleared' },
      ]} />
      <div className="space-y-3">
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search name or tracking code" />
        <ToggleGroup navigation type="single" value={filter} onValueChange={value => { if (value) setFilter(value as typeof filter); }} aria-label="Filter clearance status">
          <ToggleGroupItem value="all" size="sm">All candidates</ToggleGroupItem>
          <ToggleGroupItem value="awaiting-local" size="sm">Awaiting local agency</ToggleGroupItem>
          <ToggleGroupItem value="in-clearance" size="sm">In clearance</ToggleGroupItem>
          <ToggleGroupItem value="awaiting-ministry" size="sm">Awaiting ministry</ToggleGroupItem>
          <ToggleGroupItem value="action-required" size="sm">Action required</ToggleGroupItem>
          <ToggleGroupItem value="cleared" size="sm">Cleared</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No candidates match this clearance filter and search. Clear the filters or ask the local agency to update the candidate’s visa, Enjaz, and Tasheer records.
        </CardContent></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(c => {
          const steps = stepsOf(c);
          const blockers = clearanceBlockers(c);
          return (
            <Card key={c.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2"><CandidateAvatar candidate={c} className="h-9 w-9" /><div>
                    <p className="font-semibold">{c.first_name} {c.last_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{c.tracking_code}</p>
                  </div></div>
                  {isCleared(c)
                    ? <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Cleared</Badge>
                    : <Badge variant="outline">{blockers.length} step{blockers.length === 1 ? '' : 's'} left</Badge>}
                </div>
                <ol className="space-y-3">
                  {steps.map((step, i) => {
                    const { dot, text, Icon } = STYLE[step.state];
                    return (
                      <li key={step.key} className="relative flex gap-3">
                        {i < steps.length - 1 && <span className={cn('absolute left-3.5 top-8 -bottom-3 w-0.5', step.state === 'done' ? 'bg-emerald-500' : 'bg-border')} />}
                        <span className={cn('z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2', dot)}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-medium leading-tight">{step.title}</p>
                          <p className={cn('text-xs capitalize', text)}>
                            {step.state === 'waiting' ? 'Not started' : step.state === 'done' ? 'Completed' : step.state}
                            {step.detail ? <span className="font-mono normal-case text-muted-foreground"> · {step.detail}</span> : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AgencyClearanceTracker;
