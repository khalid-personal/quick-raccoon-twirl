import { useEffect, useState } from 'react';
import { Download, FileCheck2, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { getCandidates, getCandidateStages } from '@/lib/data-store';
import { useAuth } from '@/lib/auth-context';
import { buildClearanceCsv } from '@/lib/ksa-visa';
import { isDemoMode } from '@/lib/demo-mode';
import type { Candidate } from '@/lib/types';
import PageHeader from './page/PageHeader';
import StatCards from './page/StatCards';
import FilterBar from './page/FilterBar';
import CandidateAvatar from './CandidateAvatar';
import { useCandidateWorkspace } from './CandidateQuickViewProvider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const references = (candidate: Candidate) => [
  { label: 'Visa', reference: candidate.visa?.visa_number, status: candidate.visa?.status },
  { label: 'Enjaz', reference: candidate.clearance?.enjaz?.reference, status: candidate.clearance?.enjaz?.status },
  { label: 'Tasheer', reference: candidate.clearance?.tasheer?.reference, status: candidate.clearance?.tasheer?.status },
  { label: 'Ministry QR / certificate', reference: candidate.clearance?.labour_ministry?.certificate_no, status: candidate.clearance?.labour_ministry?.status },
];

export default function MinistryClearanceConsole() {
  const { userRole, user, viewAs, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const workspace = useCandidateWorkspace();
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'issued' | 'awaiting' | 'review'>('all');
  const [limit, setLimit] = useState(12);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener('supabase-data-changed', update);
    window.addEventListener('storage', update);
    const timer = window.setInterval(update, 15000);
    return () => { window.removeEventListener('supabase-data-changed', update); window.removeEventListener('storage', update); window.clearInterval(timer); };
  }, []);
  const staffId = viewAs?.userId ?? user?.id;
  const stageAssignments = new Set(userRole === 'staff' && staffId ? getCandidateStages().filter(stage => stage.assigned_staff_id === staffId).map(stage => stage.candidate_id) : []);
  const candidates = getCandidates().filter(candidate => {
    if (userRole === 'local-agency') return !!userLocalAgencyId && candidate.local_agency_id === userLocalAgencyId;
    if (['agency', 'foreign-agency', 'foreign-agency-staff'].includes(userRole ?? '')) return !!userForeignAgencyId && (candidate.foreign_agency_id === userForeignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId));
    if (userRole === 'staff') return !!staffId && (candidate.assigned_staff_id === staffId || stageAssignments.has(candidate.id));
    return ['admin', 'superadmin'].includes(userRole ?? '');
  });
  const issued = (candidate: Candidate) => candidate.clearance?.labour_ministry?.status === 'cleared' && !!candidate.clearance.labour_ministry.certificate_no;
  const review = (candidate: Candidate) => references(candidate).some(item => ['rejected', 'error', 'mismatch', 'invalid', 'expired'].includes(item.status ?? ''));
  const rows = candidates.filter(candidate => (filter === 'all' || (filter === 'issued' ? issued(candidate) : filter === 'review' ? review(candidate) : !issued(candidate)))
    && `${candidate.first_name} ${candidate.last_name} ${candidate.tracking_code} ${references(candidate).map(item => item.reference).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const selectFilter = (next: typeof filter) => { setFilter(next); setLimit(12); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([buildClearanceCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'ministry-references.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="ministry-clearance-console space-y-5" data-revision={revision}>
    <PageHeader title="Ministry clearance references" description="Visa, Enjaz, Tasheer and deployment QR references arrive from the ministry." actions={<Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Export references</Button>} />
    <section className="portal-source-strip"><ShieldCheck /><span>Ministry-owned · read-only</span><Badge variant="outline">{isDemoMode() ? 'Practice source records' : 'Ministry connection pending'}</Badge><Button variant="ghost" onClick={() => setRevision(value => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Refresh view</Button></section>
    <StatCards items={[
      { label: 'Candidates', value: candidates.length, icon: <ShieldCheck />, onClick: () => selectFilter('all'), active: filter === 'all' },
      { label: 'QR reference issued', value: candidates.filter(issued).length, icon: <QrCode />, onClick: () => selectFilter('issued'), active: filter === 'issued' },
      { label: 'Awaiting ministry', value: candidates.filter(candidate => !issued(candidate)).length, icon: <RefreshCw />, onClick: () => selectFilter('awaiting'), active: filter === 'awaiting' },
      { label: 'Needs follow-up', value: candidates.filter(review).length, icon: <FileCheck2 />, onClick: () => selectFilter('review'), active: filter === 'review' },
    ]} />
    <FilterBar search={search} onSearchChange={value => { setSearch(value); setLimit(12); }} searchPlaceholder="Search candidate or ministry reference" />
    <div className="grid gap-4 lg:grid-cols-2">{rows.slice(0, limit).map(candidate => <article className="ministry-reference-card" key={candidate.id}>
      <header className="flex items-center justify-between gap-3"><button className="flex min-w-0 items-center gap-3 text-left" onClick={() => workspace?.(candidate.id, { tab: 'timeline', stageId: 4 })}><CandidateAvatar candidate={candidate} className="h-12 w-12 shrink-0" /><span><strong className="block">{candidate.first_name} {candidate.last_name}</strong><span className="text-muted-foreground">{candidate.tracking_code}</span></span></button><QrCode className="shrink-0 text-primary" /></header>
      <ol className="ministry-reference-track">{references(candidate).map(item => <li key={item.label}><span className={item.reference ? 'ministry-reference-dot is-recorded' : 'ministry-reference-dot'} /><div><h3>{item.label}</h3><p className="break-all">{item.reference || 'Awaiting ministry reference'}</p></div><Badge variant="outline">{item.status?.replace(/_/g, ' ') || 'Awaiting'}</Badge></li>)}</ol>
    </article>)}</div>
    {!rows.length && <p className="ministry-result-card text-muted-foreground">No candidates match this view.</p>}
    {rows.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 12)}>Show more · {rows.length - limit} remaining</Button>}
  </div>;
}
