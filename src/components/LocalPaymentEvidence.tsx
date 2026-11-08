import { useEffect, useState } from 'react';
import { usePageMemory } from '@/hooks/use-page-memory';
import { ArrowRight, BadgeCheck, ClipboardList, GraduationCap, HeartPulse, Landmark, Plane, Search } from 'lucide-react';
import { usePortalData } from '@/hooks/use-portal-data';
import { useAuth } from '@/lib/auth-context';
import { compileCandidateEvidence, type CandidateEvidenceRecord } from '@/lib/candidate-evidence-record';
import { loadBankStatement } from '@/lib/bank-statement-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import WidgetShell from './WidgetShell';
import CandidateAvatar from './CandidateAvatar';
import PaymentEvidenceReview, { type PaymentEvidence } from './PaymentEvidenceReview';
import { navigationItemClass } from './ui/navigation-rail';

const icons = [ClipboardList, GraduationCap, HeartPulse, Plane];
export default function LocalPaymentEvidence({ localAgencyId }: { localAgencyId?: string }) {
  const data = usePortalData();
  const { userRole } = useAuth();
  const [agency, setAgency] = usePageMemory('evidence-agency', localAgencyId ?? '');
  const [filter, setFilter] = usePageMemory<'all' | 'pending' | 'settled'>('evidence-filter-v2', 'pending');
  const [search, setSearch] = usePageMemory('evidence-search', '');
  const [showAll, setShowAll] = usePageMemory('evidence-expanded', false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<PaymentEvidence | null>(null);
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('bank-statement-changed', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('bank-statement-changed', update); window.removeEventListener('storage', update); };
  }, []);
  const records = data.candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId).map(candidate =>
    compileCandidateEvidence(candidate, data.stages, data.payments, data.paymentStatuses, data.stageFees, loadBankStatement(candidate.local_agency_id ?? '', 'candidate')));
  const scoped = records.filter(record => !agency || record.candidate.local_agency_id === agency);
  const visible = scoped.filter(record => (filter === 'all' || record.status === filter) && `${record.candidate.first_name} ${record.candidate.last_name} ${record.candidate.tracking_code}`.toLowerCase().includes(search.toLowerCase()));
  const selected = records.find(record => record.candidate.id === selectedId);
  const reviewRow = (record: CandidateEvidenceRecord, row: CandidateEvidenceRecord['rows'][number], payment = row.receipts[0]) => {
    setReview({ caseId: payment?.id ?? `local-fee:${record.candidate.id}:${row.meta.id}`, candidateId: record.candidate.id, source: 'candidate', stageTitle: row.meta.title, payment,
      expected: { amount: row.expected, currency: 'ETB', payer: `${record.candidate.first_name} ${record.candidate.last_name}`, payee: data.locals.find(local => local.id === record.candidate.local_agency_id)?.name ?? 'Unassigned agency' },
      issue: row.received > 0 && !row.feeCovered ? 'Underpaid' : !row.completed ? 'Stage not completed' : undefined });
  };
  return <WidgetShell title="Candidate payments by stage" description="See each candidate’s four stages, payment receipts and comparisons with uploaded bank records. A stage is not cleared unless the work, required fee and matching details are confirmed in order." icon={Landmark} accent="emerald" bodyClassName="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">{[
      ['Candidates', scoped.length.toLocaleString()], ['Payments received / total fees due', `${scoped.reduce((sum, record) => sum + record.received, 0).toLocaleString()} / ${scoped.reduce((sum, record) => sum + record.expected, 0).toLocaleString()} ETB`],
      ['All four stages fully checked', scoped.filter(record => record.status === 'settled').length.toLocaleString()],
    ].map(([label, value]) => <div key={label} className="rounded-xl border bg-background p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.locals.filter(local => !localAgencyId || local.id === localAgencyId).map(local => <button key={local.id} aria-pressed={agency === local.id} onClick={() => setAgency(agency === local.id && !localAgencyId ? '' : local.id)} className={`rounded-xl border p-4 text-left hover:bg-accent ${agency === local.id ? 'border-primary bg-primary/5' : ''}`}><p className="font-semibold">{local.name}</p><p className="mt-1 text-sm text-muted-foreground">{records.filter(record => record.candidate.local_agency_id === local.id).length} candidate records</p></button>)}</div>
    <div role="group" aria-label="Candidate evidence status" className="navigation-rail">{(['all', 'pending', 'settled'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} className={navigationItemClass(filter === value)} onClick={() => setFilter(value)}>{value === 'all' ? 'All candidates' : value === 'pending' ? 'Needs payment or stage review' : 'All stages fully checked'} · {scoped.filter(record => value === 'all' || record.status === value).length}</button>)}</div>
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search local payment evidence" placeholder="Candidate or tracking code" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div>
    <div className="max-h-[34rem] space-y-3 overflow-auto">{(showAll ? visible : visible.slice(0, 8)).map(record => <article key={record.candidate.id} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><CandidateAvatar candidate={record.candidate} className="h-12 w-12" /><div><p className="font-semibold">{record.candidate.first_name} {record.candidate.last_name}</p><p className="text-sm text-muted-foreground">{record.candidate.tracking_code} · {record.receipts.length} receipts · {record.completed}/4 stages complete</p><p className="text-sm">{record.received.toLocaleString()} / {record.expected.toLocaleString()} ETB</p>{record.rows.some(row => row.received > 0 && !row.feeCovered) && <Badge variant="outline">Stage fee not fully covered</Badge>}</div></div>
        <div className="flex flex-wrap items-center gap-2"><Badge className={record.status === 'settled' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}>{record.status === 'settled' ? 'Payment received · all stages checked' : 'Payment or stage needs review'}</Badge><Button size="sm" variant="outline" onClick={() => setSelectedId(record.candidate.id)}>View full payment record<ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{record.rows.map((row, index) => { const Icon = icons[index]; return <div key={row.meta.id} className={`rounded-lg border p-2 text-sm ${row.cleared ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-muted/30'}`}><p className="flex items-center gap-1 font-medium"><Icon className="h-4 w-4" />{row.meta.title}</p><p className="text-xs text-muted-foreground">{row.cleared ? 'Work complete · fee covered · bank details match' : `${row.stage?.status ?? 'Not recorded'} · ${row.feeCovered ? 'required fee covered' : 'fee still due'}`}</p></div>; })}</div>
    </article>)}{!visible.length && <p className="p-6 text-center text-muted-foreground">No candidate records match.</p>}</div>
    {!showAll && visible.length > 8 && <Button variant="ghost" onClick={() => setShowAll(true)}>Show all {visible.length} candidate records</Button>}
    <Dialog open={!!selected && !review} onOpenChange={open => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Candidate payment record by stage</DialogTitle><DialogDescription>Registration → Training → Medical → Deployment. A stage counts as cleared only after the work, required fee and matching details are confirmed in order. This record never completes a stage automatically.</DialogDescription></DialogHeader>
      {selected && <><h3 className="text-xl font-semibold">{selected.candidate.first_name} {selected.candidate.last_name}</h3><p>{selected.completed}/4 stages complete · {selected.cleared}/4 fully cleared · {selected.received.toLocaleString()} / {selected.expected.toLocaleString()} ETB</p>
        <div className="space-y-3">{selected.rows.map((row, index) => { const Icon = icons[index]; return <section key={row.meta.id} className="space-y-3 rounded-xl border p-4"><h4 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5" />{index + 1}. {row.meta.title}{row.cleared && <BadgeCheck className="h-5 w-5 text-emerald-600" />}</h4><div className="grid gap-2 text-sm sm:grid-cols-4"><p>Work: <strong>{row.stage?.status ?? 'Not recorded'}</strong></p><p>Fee: <strong>{row.received.toLocaleString()} / {row.expected.toLocaleString()} ETB</strong></p><p>Payment record: <strong>{row.paymentRecorded ? 'Payment recorded' : 'No payment recorded'}</strong></p><p>Uploaded bank file: <strong>{row.bankMatched ? 'Matching entry found' : 'No matching entry found'}</strong></p></div>
          {row.receipts.length ? row.receipts.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-3"><p className="text-sm">{payment.receipt_number || payment.id} · {payment.amount.toLocaleString()} {payment.currency} · {payment.status}</p><Button size="sm" variant="outline" onClick={() => reviewRow(selected, row, payment)}>{row.matches.get(payment.id)?.status === 'matched' ? 'Bank matched' : payment.status === 'succeeded' && !row.matches.has(payment.id) ? 'Match bank proof' : 'View receipt & bank evidence'}</Button></div>) : <Button size="sm" variant="outline" onClick={() => reviewRow(selected, row)}>Request stage proof</Button>}
        </section>; })}</div>
        {selected.unallocated.length > 0 && <p role="alert" className="rounded-lg border border-amber-500/30 p-3 text-sm">{selected.unallocated.length} shared or unassigned payment(s) are listed but have not been assigned to a stage fee, so they are not counted toward stage fees.</p>}
        {selected.foreignReceipts.length > 0 && <div className="space-y-3 rounded-xl border p-4"><h4 className="text-lg font-semibold">Related foreign-agency transfers</h4><p className="text-sm text-muted-foreground">These receipts reference this candidate, but may cover several workers. They are never treated as local stage-fee payments or divided without an explicit allocation.</p>{selected.foreignReceipts.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-3"><p className="text-sm">{payment.receipt_number || payment.id} · {payment.amount.toLocaleString()} {payment.currency} · {payment.status} · {payment.candidate_ids.length} worker(s)</p><Button size="sm" variant="outline" onClick={() => setReview({ caseId: payment.id, candidateId: selected.candidate.id, source: 'foreign', payment })}>View agency transfer evidence</Button></div>)}</div>}
      </>}
    </DialogContent></Dialog>
    <PaymentEvidenceReview evidence={review} agencyId={selected?.candidate.local_agency_id ?? ''} statementName={loadBankStatement(selected?.candidate.local_agency_id ?? '', review?.source ?? 'candidate')?.name ?? 'No statement'} allowActions={userRole === 'superadmin' || userRole === 'local-agency'} onClose={() => setReview(null)} />
  </WidgetShell>;
}
