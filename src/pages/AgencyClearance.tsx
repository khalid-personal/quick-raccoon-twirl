import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Download, FileCheck2, Loader2, Printer, QrCode, ShieldCheck, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getCandidates } from '@/lib/data-store';
import {
  buildClearanceCsv, checkClearanceStep, clearanceBlockers, clearCandidate, getVisaServiceInfo,
  isCleared, isVisaValid, printClearanceCertificate, simulateMinistryQrIssuance, verifyVisa,
} from '@/lib/ksa-visa';
import { isDemoMode } from '@/lib/demo-mode';
import type { Candidate, ClearanceStepKey } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import StatCards from '@/components/page/StatCards';
import FilterBar from '@/components/page/FilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CandidateAvatar from '@/components/CandidateAvatar';

const TONE = {
  good: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  bad: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  warn: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  idle: 'bg-muted text-muted-foreground border-border',
};

const visaTone = (c: Candidate) => {
  if (!c.visa) return TONE.idle;
  if (isVisaValid(c)) return TONE.good;
  return c.visa.status === 'pending' ? TONE.warn : TONE.bad;
};
const stepTone = (status?: string) => (status === 'completed' ? TONE.good : status === 'rejected' ? TONE.bad : TONE.idle);
const label = (value?: string) => (value ? value.replace(/_/g, ' ') : 'unchecked');

const useDataVersion = () => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener('supabase-data-changed', bump);
    return () => window.removeEventListener('supabase-data-changed', bump);
  }, []);
  return version;
};

const AgencyClearance: React.FC = () => {
  const { user, userRole, userLocalAgencyId, userLocalAgencyName } = useAuth();
  // Local agencies clear their own candidates; staff and superadmin see everyone. Foreign agencies get the read-only tracker instead.
  const isLocal = userRole === 'local-agency';
  const scopeName = isLocal ? userLocalAgencyName : 'DAWM';
  const version = useDataVersion();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [serviceInfo, setServiceInfo] = useState<{ modes: Record<string, 'live' | 'sandbox'>; providerName: string } | null>(null);

  useEffect(() => { void getVisaServiceInfo().then(setServiceInfo); }, []);

  const candidates = useMemo(
    () => getCandidates().filter(c => !isLocal || (!!userLocalAgencyId && c.local_agency_id === userLocalAgencyId)),
    [isLocal, userLocalAgencyId, version, tick],
  );

  const actor = { id: user?.id ?? '', email: user?.email ?? '' };
  const draft = (key: string, fallback = '') => drafts[key] ?? fallback;
  const setDraft = (key: string, value: string) => setDrafts(prev => ({ ...prev, [key]: value }));

  const run = async (key: string, task: () => Promise<string>) => {
    setBusy(key);
    try {
      toast.success(await task());
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
      setTick(t => t + 1);
    }
  };

  const doVisa = (c: Candidate) => run(`visa-${c.id}`, async () => {
    const number = draft(`visa-${c.id}`, c.visa?.visa_number).trim();
    const record = await verifyVisa(c, number, actor);
    return `Visa ${label(record.status)}`;
  });
  const doStep = (c: Candidate, step: ClearanceStepKey) => run(`${step}-${c.id}`, async () => {
    const reference = draft(`${step}-${c.id}`, c.clearance?.[step]?.reference).trim();
    if (!reference) throw new Error('Enter the reference first.');
    const result = await checkClearanceStep(c, step, reference, actor);
    return `${step === 'enjaz' ? 'Enjaz' : 'Tasheer'} ${label(result[step]?.status)}`;
  });
  const doClear = (c: Candidate) => run(`clear-${c.id}`, async () => {
    const result = await clearCandidate(c, actor);
    return result.local_ready_at ? 'Local checks passed. Awaiting Labour Ministry confirmation and QR.' : 'Clearance state updated.';
  });
  const doSimulateMinistryQr = (c: Candidate) => run(`ministry-qr-${c.id}`, async () => {
    const result = await simulateMinistryQrIssuance(c, actor);
    return `Demo QR issued: ${result.certificate_no}`;
  });

  const rows = candidates.filter(c => {
    const query = search.trim().toLowerCase();
    const matches = !query || `${c.first_name} ${c.last_name} ${c.tracking_code} ${c.passport_number}`.toLowerCase().includes(query);
    const byFilter = filter === 'cleared' ? isCleared(c) : filter === 'open' ? !isCleared(c) : filter === 'novisa' ? !isVisaValid(c)
      : filter === 'visa' ? isVisaValid(c) : filter === 'enjaz' ? c.clearance?.enjaz?.status === 'completed'
        : filter === 'tasheer' ? c.clearance?.tasheer?.status === 'completed' : true;
    return matches && byFilter;
  });

  const stats = [
    { label: 'Candidates', value: candidates.length, icon: <ShieldCheck className="h-4 w-4" />, onClick: () => setFilter('all'), active: filter === 'all' },
    { label: 'Visa validated', value: candidates.filter(isVisaValid).length, icon: <BadgeCheck className="h-4 w-4" />, onClick: () => setFilter(filter === 'visa' ? 'all' : 'visa'), active: filter === 'visa' },
    { label: 'Enjaz done', value: candidates.filter(c => c.clearance?.enjaz?.status === 'completed').length, icon: <FileCheck2 className="h-4 w-4" />, onClick: () => setFilter(filter === 'enjaz' ? 'all' : 'enjaz'), active: filter === 'enjaz' },
    { label: 'Tasheer done', value: candidates.filter(c => c.clearance?.tasheer?.status === 'completed').length, icon: <Stamp className="h-4 w-4" />, onClick: () => setFilter(filter === 'tasheer' ? 'all' : 'tasheer'), active: filter === 'tasheer' },
    { label: 'Fully cleared', value: candidates.filter(isCleared).length, icon: <BadgeCheck className="h-4 w-4" />, onClick: () => setFilter(filter === 'cleared' ? 'all' : 'cleared'), active: filter === 'cleared' },
  ];

  const download = () => {
    const url = URL.createObjectURL(new Blob([buildClearanceCsv(candidates)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clearance.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const modeBadge = (service: string, name: string) => serviceInfo && (
    <Badge variant="outline" className={serviceInfo.modes[service] === 'live' ? TONE.good : TONE.warn}>{name}: {serviceInfo.modes[service]}</Badge>
  );

  if (isLocal && !userLocalAgencyId) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance & Visa"
        description={`Check visas and required travel approvals for ${isLocal ? `${userLocalAgencyName ?? 'your agency’s'}` : 'all'} candidates.`}
        actions={<Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Export</Button>}
      />
      <StatCards items={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How clearance works</CardTitle>
          <CardDescription>
            Check the visa, then confirm the required Enjaz and Tasheer travel checks. The official certificate stays locked until the Labour Ministry provides its certificate number and QR code.
            Reopening a completed step cancels the previous ministry result and requires a new check.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            {modeBadge('visa', serviceInfo?.providerName ?? 'Visa provider')}{modeBadge('enjaz', 'Enjaz')}{modeBadge('tasheer', 'Tasheer')}
            {!serviceInfo && !isDemoMode() && <span className="text-xs text-destructive">Live clearance checks are unavailable; provider integration is not configured.</span>}
            {serviceInfo && Object.values(serviceInfo.modes).includes('sandbox') && (
              <span className="text-xs text-muted-foreground">Practice results are made up, not official approvals. Real checks require a connected service.</span>
            )}
          </div>
        </CardHeader>
      </Card>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[['all', 'All'], ['open', 'Not cleared'], ['novisa', 'Visa not valid'], ['visa', 'Visa validated'], ['enjaz', 'Enjaz done'], ['tasheer', 'Tasheer done'], ['cleared', 'Cleared']]}
        filter={filter}
        onFilterChange={setFilter}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Visa</TableHead>
                <TableHead>Enjaz</TableHead>
                <TableHead>Tasheer</TableHead>
                <TableHead className="text-right">Clearance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No candidates match.</TableCell></TableRow>
              )}
              {rows.map(c => {
                const blockers = clearanceBlockers(c);
                const ministryStatus = c.clearance?.labour_ministry?.status;
                const ministrySimulated = c.clearance?.labour_ministry?.simulated;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2"><CandidateAvatar candidate={c} className="h-9 w-9" /><div>
                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.tracking_code} · {c.passport_number}</div>
                      </div></div>
                    </TableCell>
                    <TableCell className="min-w-[210px]">
                      <div className="flex gap-1">
                        <Input aria-label={`Visa number for ${c.tracking_code}`} className="h-8" placeholder="Visa number" value={draft(`visa-${c.id}`, c.visa?.visa_number)} onChange={e => setDraft(`visa-${c.id}`, e.target.value)} />
                        <Button size="sm" variant="outline" disabled={busy === `visa-${c.id}` || !draft(`visa-${c.id}`, c.visa?.visa_number).trim()} onClick={() => doVisa(c)}>
                          {busy === `visa-${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : isDemoMode() ? 'Simulate' : 'Verify'}
                        </Button>
                      </div>
                      <Badge variant="outline" className={`mt-1 ${visaTone(c)}`}>{label(c.visa?.status)}</Badge>
                      {c.visa?.expiry_date && <span className="ml-2 text-xs text-muted-foreground">exp {c.visa.expiry_date}</span>}
                      {c.visa?.message && <p className="mt-1 text-xs text-muted-foreground">{c.visa.message}</p>}
                      {c.visa?.mismatches?.length ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Mismatch: {c.visa.mismatches.join(', ')}</p> : null}
                    </TableCell>
                    {(['enjaz', 'tasheer'] as ClearanceStepKey[]).map(step => (
                      <TableCell key={step} className="min-w-[200px]">
                        <div className="flex gap-1">
                          <Input aria-label={`${step} reference for ${c.tracking_code}`} className="h-8" placeholder="Reference" value={draft(`${step}-${c.id}`, c.clearance?.[step]?.reference)} onChange={e => setDraft(`${step}-${c.id}`, e.target.value)} />
                          <Button size="sm" variant="outline" disabled={busy === `${step}-${c.id}` || !draft(`${step}-${c.id}`, c.clearance?.[step]?.reference).trim()} onClick={() => doStep(c, step)}>
                            {busy === `${step}-${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : isDemoMode() ? 'Simulate' : 'Check'}
                          </Button>
                        </div>
                        <Badge variant="outline" className={`mt-1 ${stepTone(c.clearance?.[step]?.status)}`}>{label(c.clearance?.[step]?.status ?? 'pending')}</Badge>
                        {c.clearance?.[step]?.message && <p className="mt-1 text-xs text-muted-foreground">{c.clearance[step]?.message}</p>}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {isCleared(c) ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className={TONE.good}>Cleared</Badge>
                          <span className="font-mono text-xs text-muted-foreground">{c.clearance?.labour_ministry?.certificate_no}</span>
                          <Button size="sm" variant="outline" onClick={() => { try { printClearanceCertificate(c, scopeName ?? ''); } catch (e) { toast.error((e as Error).message); } }}>
                            <Printer className="mr-1 h-4 w-4" />Certificate
                          </Button>
                        </div>
                      ) : ministrySimulated ? (
                        <div className="flex max-w-[190px] flex-col items-end gap-2 text-right">
                          <Badge variant="outline" className={TONE.warn}>Demo QR issued</Badge>
                          <img className="h-28 w-28 border bg-white p-1" src={c.clearance?.labour_ministry?.qr_image_url} alt={`Demo-only clearance QR for ${c.tracking_code}`} />
                          <span className="font-mono text-xs text-muted-foreground">{c.clearance?.labour_ministry?.certificate_no}</span>
                          <span className="text-xs text-muted-foreground">Simulation only. Not ministry-issued; printing is disabled.</span>
                        </div>
                      ) : ministryStatus === 'rejected' || ministryStatus === 'error' ? (
                        <div className="flex max-w-[190px] flex-col items-end gap-1 text-right">
                          <Badge variant="outline" className={TONE.bad}>Ministry review required</Badge>
                          <span className="text-xs text-muted-foreground">{c.clearance?.labour_ministry?.message ?? 'Check the ministry response before retrying.'}</span>
                        </div>
                      ) : c.clearance?.local_ready_at ? (
                        <div className="flex max-w-[190px] flex-col items-end gap-1 text-right">
                          <Badge variant="outline" className={TONE.warn}>Awaiting ministry QR</Badge>
                          <span className="text-xs text-muted-foreground">{c.clearance?.labour_ministry?.message ?? 'Print unlocks after issuer confirmation.'}</span>
                          {isDemoMode() && <Button size="sm" variant="outline" disabled={busy === `ministry-qr-${c.id}`} onClick={() => doSimulateMinistryQr(c)}>
                            {busy === `ministry-qr-${c.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />}
                            Simulate ministry QR
                          </Button>}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Button size="sm" disabled={blockers.length > 0 || busy === `clear-${c.id}`} onClick={() => doClear(c)}>Mark locally ready</Button>
                          {blockers.length > 0 && <span className="text-xs text-muted-foreground">{blockers.join(' · ')}</span>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyClearance;
