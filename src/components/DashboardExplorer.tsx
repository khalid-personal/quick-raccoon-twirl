import { useEffect, useState } from 'react';
import { CandidateWorkspaceLink, EntityProfileButton } from './CandidateQuickViewProvider';
import { ArrowLeft, ArrowUpRight, Building2, ChartNoAxesCombined, ChevronRight, Globe2, GraduationCap, MapPin, ShieldAlert, Users, Wallet } from 'lucide-react';
import { usePortalData } from '@/hooks/use-portal-data';
import { getCocFacilities } from '@/lib/data-store';
import { candidateCity, candidateRegion, groupCandidates, selectDashboardCandidates, type DashboardSelection } from '@/lib/dashboard-drilldown';
import { calculateOverallStatus } from '@/lib/utils-data';
import { analyzeAgencyPayments, isDiscrepancy, ISSUE_LABEL } from '@/lib/agency-payments';
import { isForeignPayment } from '@/lib/currency';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CandidateAvatar from '@/components/CandidateAvatar';
import { isCleared } from '@/lib/ksa-visa';
import { ALL_STAGES } from '@/lib/types';
import { isStageComplete } from '@/lib/candidate-stage-normalization';
import { REGION_NOT_SET } from '@/lib/ethiopia-regions';

function Ranking({ rows, label, onSelect, tone = 'bg-primary' }: { rows: Array<{ name: string; count: number; id?: string }>; label: string; onSelect: (row: { name: string; count: number; id?: string }) => void; tone?: string }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return <div className="max-h-80 space-y-1 overflow-y-auto">
    {rows.map((row, index) => <button key={row.id || row.name} type="button" aria-label={`Inspect ${label} ${row.name}`} onClick={() => onSelect(row)} className="group w-full rounded-xl border border-transparent px-2 py-3 text-left transition-colors hover:border-primary/20 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="mb-2 flex items-center gap-2 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-background/70 text-xs font-semibold text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span><span className="text-lg font-bold tabular-nums">{row.count}</span><ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></div>
      <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tone}`} style={{ width: `${row.count / max * 100}%` }} /></div>
    </button>)}
    {!rows.length && <p className="py-6 text-sm text-muted-foreground">No records match this selection.</p>}
  </div>;
}

export default function DashboardExplorer({ localAgencyId, candidateBasePath, selection, onSelect, onClose }: {
  localAgencyId?: string; candidateBasePath: string; selection: DashboardSelection | null;
  onSelect: (selection: DashboardSelection) => void; onClose: () => void;
}) {
  const { candidates, stages, payments, locals, foreigns } = usePortalData();
  const facilities = getCocFacilities();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('overview');
  useEffect(() => { setSearch(''); setTab('overview'); }, [selection?.kind, selection?.id, selection?.name]);
  const scoped = candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId);
  const selectedCandidates = selection ? selectDashboardCandidates(candidates, stages, selection, localAgencyId) : [];
  const regions = groupCandidates(scoped, candidateRegion);
  const official = scoped.filter(isCleared).length;
  const awaitingMinistry = scoped.filter(candidate => candidate.clearance?.local_ready_at && !isCleared(candidate)).length;
  const cities = groupCandidates(selectedCandidates, candidateCity);
  const rankAgencies = (kind: 'local-agency' | 'foreign-agency' | 'coc') => {
    const records = kind === 'local-agency' ? locals : kind === 'foreign-agency' ? foreigns : facilities;
    return records.map(record => ({ id: record.id, name: record.name, count: scoped.filter(candidate => (kind === 'local-agency' ? candidate.local_agency_id : kind === 'foreign-agency' ? candidate.foreign_agency_id : candidate.coc_facility_id) === record.id).length })).filter(row => row.count).sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
  };
  const agency = selection?.kind === 'local-agency' ? locals.find(record => record.id === selection.id)
    : selection?.kind === 'foreign-agency' ? foreigns.find(record => record.id === selection.id) : undefined;
  const selectedIds = new Set(selectedCandidates.map(candidate => candidate.id));
  const selectedPayments = payments.filter(payment => {
    if (localAgencyId && payment.payee_local_agency_id !== localAgencyId) return false;
    if (selection?.kind === 'local-agency') return payment.payee_local_agency_id === selection.id;
    if (selection?.kind === 'foreign-agency') return payment.payer_foreign_agency_id === selection.id;
    return payment.candidate_ids.some(id => selectedIds.has(id));
  });
  const flags = analyzeAgencyPayments(selectedCandidates, payments, stages).rows.filter(row => isDiscrepancy(row.issue));
  const received = selectedPayments.filter(payment => payment.status === 'succeeded').reduce<Record<string, number>>((totals, payment) => ({ ...totals, [payment.currency]: (totals[payment.currency] || 0) + payment.amount }), {});
  const matchingCandidates = selectedCandidates.filter(candidate => `${candidate.first_name} ${candidate.last_name} ${candidate.tracking_code} ${candidateCity(candidate)} ${candidateRegion(candidate)}`.toLowerCase().includes(search.toLowerCase()));
  const candidateTable = <>
    <Input aria-label="Search drill-down candidates" placeholder="Name, tracking code, city or region" value={search} onChange={event => setSearch(event.target.value)} />
    <p className="text-xs text-muted-foreground">{matchingCandidates.length} of {selectedCandidates.length} candidates</p>
    <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>City</TableHead><TableHead>Region</TableHead><TableHead>Stage status</TableHead><TableHead>Profile</TableHead></TableRow></TableHeader><TableBody>
      {matchingCandidates.map(candidate => <TableRow key={candidate.id}>
        <TableCell><div className="flex items-center gap-2"><CandidateAvatar candidate={candidate} className="h-9 w-9" /><div><p className="font-medium">{candidate.first_name} {candidate.last_name}</p><p className="font-mono text-xs text-muted-foreground">{candidate.tracking_code}</p></div></div></TableCell>
        <TableCell>{candidateCity(candidate)}</TableCell><TableCell>{candidateRegion(candidate)}</TableCell>
        <TableCell><Badge variant="outline">{calculateOverallStatus(stages.filter(stage => stage.candidate_id === candidate.id))}</Badge></TableCell>
        <TableCell><Button asChild variant="outline" size="sm"><CandidateWorkspaceLink candidateId={candidate.id} to={`${candidateBasePath}/${candidate.id}`} onClick={onClose}><ArrowUpRight className="mr-1 h-4 w-4" />Open</CandidateWorkspaceLink></Button></TableCell>
      </TableRow>)}
      {!matchingCandidates.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No matching candidates.</TableCell></TableRow>}
    </TableBody></Table></div>
  </>;

  return <>
    <section aria-label="Workforce network explorer" className="space-y-5">
      <header className="network-command">
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#c8f575]">Origins · partners · readiness</p><h2 className="mt-2 text-3xl font-semibold">Explore the workforce network</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">Follow actual candidate connections from home communities to training and destination partners. Open a node or ranking to inspect the linked people, receipts and records.</p></div><Badge className="border border-white/20 bg-white/10 text-white" variant="outline">{localAgencyId ? 'Selected agency' : 'All agencies'} · {scoped.length} candidates</Badge></div>
          <div className="network-path" aria-label="Candidate network connections">
            {[
              { title: 'Home regions', count: regions.filter(region => region.name !== REGION_NOT_SET).length, detail: 'Recorded candidate origins', Icon: MapPin },
              { title: 'Local agencies', count: rankAgencies('local-agency').length, detail: 'Intake and candidate ownership', Icon: Building2 },
              { title: 'Training centers', count: rankAgencies('coc').length, detail: 'CoC training assignments', Icon: GraduationCap },
              { title: 'Foreign partners', count: rankAgencies('foreign-agency').length, detail: 'Destination agency connections', Icon: Globe2 },
            ].map(({ title, count, detail, Icon }) => <button type="button" key={title} onClick={() => onSelect({ kind: 'all', name: 'Network candidate roster' })}><Icon className="mb-3 h-6 w-6" /><p className="text-3xl font-semibold tabular-nums">{count}</p><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-xs text-white/70">{detail}</p><p className="mt-3 flex items-center gap-1 text-xs text-[#c8f575]">Inspect candidate roster <ArrowUpRight className="h-3 w-3" /></p></button>)}
          </div>
          <div className="space-y-3"><p className="text-sm font-semibold">Recorded journey coverage <span className="font-normal text-white/65">· completion does not grant official travel approval</span></p><div className="portal-metric-grid">
            {ALL_STAGES.map((stage, index) => {
              const completed = scoped.filter(candidate => stages.some(record => record.candidate_id === candidate.id && record.stage_id === stage.id && isStageComplete(record.status))).length;
              const reached = scoped.filter(candidate => stages.some(record => record.candidate_id === candidate.id && record.stage_id === stage.id && record.status !== 'Pending')).length;
              return <button type="button" key={stage.id} onClick={() => onSelect({ kind: 'stage', stageId: stage.id, name: `${stage.title} · reached candidates` })} className="min-w-0 rounded-xl border border-white/15 bg-black/10 p-4 text-left hover:bg-white/10"><p className="text-xs font-semibold text-[#c8f575]">0{index + 1} · {stage.title}</p><p className="mt-2 text-lg font-semibold">{completed} <span className="text-xs font-normal text-white/65">of {scoped.length} complete</span></p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#c8f575]" style={{ width: `${scoped.length ? completed / scoped.length * 100 : 0}%` }} /></div><p className="mt-2 text-xs text-white/65">Inspect {reached} reached candidates →</p></button>;
            })}
          </div></div>
          <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-full border border-white/15 px-3 py-2">{official} official clearances recorded</span><span className="rounded-full border border-white/15 px-3 py-2">{awaitingMinistry} locally ready, awaiting ministry</span><span className="rounded-full border border-white/15 px-3 py-2">{scoped.filter(candidate => !candidate.foreign_agency_id).length} without a destination partner</span></div>
          <p className="text-xs text-white/65">Connections are profile assignments, not travel authorization. Ministry approval and payment checks are separate; practice QR codes never count as official clearance. Live ministry-provider integration is not configured. Backend-recorded journey statuses refresh while the signed-in portal is open; no official checks are invented.</p>
        </div>
      </header>
      <p className="text-xs text-muted-foreground">Connection rankings · bars compare candidate counts with the largest group in each list. Select a named region or organization for its specific records.</p>
      <div className="portal-record-grid items-start">
      <Card className="min-w-0"><CardHeader className="pb-2"><span className="portal-widget-icon mb-2 w-fit rounded-xl p-3"><MapPin className="h-6 w-6" /></span><CardTitle className="text-xl">Top Regions</CardTitle><p className="text-sm text-muted-foreground">Candidate origins · {scoped.length} records</p></CardHeader><CardContent>
        <Ranking rows={regions.slice(0, 8)} label="region" onSelect={row => onSelect({ kind: 'region', name: row.name })} />
        {regions.length > 8 && <Button variant="ghost" size="sm" onClick={() => onSelect({ kind: 'all', name: 'All candidate origins' })}>All origins<ChevronRight className="ml-1 h-4 w-4" /></Button>}
      </CardContent></Card>
      {(['foreign-agency', 'coc', 'local-agency'] as const).map(kind => {
        const Icon = kind === 'foreign-agency' ? Globe2 : kind === 'coc' ? GraduationCap : Building2;
        return <Card key={kind} className="min-w-0"><CardHeader className="pb-2"><span className="portal-widget-icon mb-2 w-fit rounded-xl p-3"><Icon className="h-6 w-6" /></span><CardTitle className="text-xl">{kind === 'foreign-agency' ? 'Foreign Agencies' : kind === 'local-agency' ? 'Local Agencies' : 'CoC Training Centers'}</CardTitle><p className="text-sm text-muted-foreground">Assigned candidates · {rankAgencies(kind).length} connected organizations</p></CardHeader><CardContent><Ranking rows={rankAgencies(kind)} label={kind} onSelect={row => onSelect({ kind, id: row.id, name: row.name })} /></CardContent></Card>;
      })}
    </div></section>
    <Dialog open={!!selection} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader><DialogTitle>{selection?.name}</DialogTitle><DialogDescription>{selectedCandidates.length} candidates · {localAgencyId ? 'Selected local agency' : 'All agencies'}</DialogDescription></DialogHeader>
      {(selection?.kind === 'local-agency' || selection?.kind === 'foreign-agency' || selection?.kind === 'coc') && <EntityProfileButton kind={selection.kind} entityId={selection.id} className="w-fit rounded-xl border bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">Open complete agency / center profile →</EntityProfileButton>}
      {selection?.kind === 'city' && selection.region && <Button variant="ghost" size="sm" className="w-fit" onClick={() => onSelect({ kind: 'region', name: selection.region! })}><ArrowLeft className="mr-2 h-4 w-4" />{selection.region}</Button>}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4"><TabsList aria-label="Explorer sections"><TabsTrigger value="overview"><ChartNoAxesCombined aria-hidden="true" />Overview</TabsTrigger><TabsTrigger value="candidates"><Users aria-hidden="true" />Candidates</TabsTrigger><TabsTrigger value="payments"><Wallet aria-hidden="true" />Payments · {selectedPayments.length}</TabsTrigger><TabsTrigger value="compliance"><ShieldAlert aria-hidden="true" />Flags · {flags.length}</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-4">
          {agency && <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Address</dt><dd>{agency.address || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Contact</dt><dd className="break-all">{agency.contact_email || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd>{agency.phone_number || 'Not recorded'}</dd></div></dl>}
          <div className="grid grid-cols-2 gap-4 border-b pb-4 sm:grid-cols-4">{[['Candidates', selectedCandidates.length], ['Cities', cities.length], ['Payments', selectedPayments.length], ['Contract flags', flags.length]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p></div>)}</div>
          {selection?.kind !== 'city' && <section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" />Cities ranked by candidates</h3><div className="max-h-64 overflow-auto"><Ranking rows={cities} label="city" onSelect={row => onSelect({ kind: 'city', name: row.name, region: selection?.kind === 'region' ? selection.name : undefined })} /></div></section>}
          {candidateTable}
        </TabsContent>
        <TabsContent value="candidates" className="space-y-3">{candidateTable}</TabsContent>
        <TabsContent value="payments" className="space-y-3">
          <p className="text-sm font-medium">Settled transaction totals: {Object.entries(received).map(([currency, amount]) => `${amount.toLocaleString()} ${currency}`).join(' · ') || 'None'}</p>
          <p className="text-xs text-muted-foreground">Full transaction amounts; one transaction can cover multiple candidates. Candidate fees and foreign transfers are labeled separately.</p>
          <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Receipt / reference</TableHead><TableHead>Source</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{selectedPayments.map(payment => <TableRow key={payment.id}><TableCell className="break-all font-mono text-xs">{payment.receipt_number || payment.provider_reference || payment.id}</TableCell><TableCell>{isForeignPayment(payment) ? 'Foreign → local' : 'Candidate → local'}</TableCell><TableCell className="whitespace-nowrap">{payment.amount.toLocaleString()} {payment.currency}</TableCell><TableCell>{payment.status}</TableCell><TableCell>{payment.created_at.slice(0, 10)}</TableCell></TableRow>)}{!selectedPayments.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No linked transactions.</TableCell></TableRow>}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="compliance" className="space-y-3"><p className="text-xs text-muted-foreground">Contract-payment checks, not confirmed bank discrepancies. Investigate receipts and statements in Payment History.</p><div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Flag</TableHead><TableHead>Explanation</TableHead></TableRow></TableHeader><TableBody>{flags.map(row => <TableRow key={row.candidate.id}><TableCell><div className="flex items-center gap-2"><CandidateAvatar candidate={row.candidate} className="h-8 w-8" />{row.candidate.first_name} {row.candidate.last_name}</div></TableCell><TableCell><Badge variant="outline">{ISSUE_LABEL[row.issue]}</Badge></TableCell><TableCell>{row.message}</TableCell></TableRow>)}{!flags.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No contract-payment flags.</TableCell></TableRow>}</TableBody></Table></div></TabsContent>
      </Tabs>
    </DialogContent></Dialog>
  </>;
}