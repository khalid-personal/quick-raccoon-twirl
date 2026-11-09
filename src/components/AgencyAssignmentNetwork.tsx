import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Globe2, Network, Users } from 'lucide-react';
import type { Candidate, ForeignAgency, LocalAgency } from '@/lib/types';
import CandidateAvatar from './CandidateAvatar';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function AgencyAssignmentNetwork({ candidates, localAgencies, foreignAgencies }: {
  candidates: Candidate[]; localAgencies: LocalAgency[]; foreignAgencies: ForeignAgency[];
}) {
  const [scope, setScope] = useState<'local' | 'foreign'>('local');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(6);
  const agencies = scope === 'local' ? localAgencies : foreignAgencies;
  const assignment = (candidate: Candidate) => scope === 'local' ? candidate.local_agency_id : candidate.foreign_agency_id;
  const activeIds = new Set(agencies.map(agency => agency.id));
  const covered = candidates.filter(candidate => activeIds.has(assignment(candidate) ?? ''));
  const matching = agencies.filter(agency => agency.name.toLowerCase().includes(search.toLowerCase()));
  const roster = selected ? covered.filter(candidate => assignment(candidate) === selected) : [];
  const selectedAgency = agencies.find(agency => agency.id === selected);
  const share = candidates.length ? Math.round(covered.length / candidates.length * 100) : 0;
  return <section id="settings-agencies" className="agency-assignment-network settings-wide-card" aria-label="Agency candidate connections">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Network className="h-4 w-4" />Connected workforce</p><h2 className="mt-2 text-2xl font-semibold">Agency constellation</h2><p className="mt-1 text-sm text-muted-foreground">Ministry-owned assignments. Select an agency to explore its people.</p></div>
      <div className="flex gap-2" aria-label="Agency directory scope">
        {(['local', 'foreign'] as const).map(value => <Button key={value} variant={scope === value ? 'default' : 'outline'} aria-pressed={scope === value} onClick={() => { setScope(value); setSelected(null); setLimit(6); }}>{value === 'local' ? <Building2 className="mr-2 h-4 w-4" /> : <Globe2 className="mr-2 h-4 w-4" />}{value === 'local' ? 'Local agencies' : 'Foreign agencies'}</Button>)}
      </div>
    </header>
    <div className="agency-coverage-summary">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label={`${share}% of candidates assigned to active ${scope} agencies`}>
        <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
        <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="8" pathLength="100" strokeDasharray={`${share} 100`} strokeLinecap="round" className="text-[#c8f575]" />
        <text x="60" y="65" textAnchor="middle" fill="currentColor" transform="rotate(90 60 60)" className="text-lg font-semibold">{share}%</text>
      </svg>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-5 sm:grid-cols-3">
        <div><strong>{agencies.length}</strong><span>Active {scope} agencies</span></div>
        <div><strong>{covered.length}</strong><span>Assigned candidates</span></div>
        <div><strong>{candidates.length - covered.length}</strong><span>Awaiting source assignment</span></div>
      </div>
    </div>
    <Input aria-label="Search agency connections" placeholder="Find an agency…" value={search} onChange={event => { setSearch(event.target.value); setLimit(6); }} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {matching.slice(0, limit).map(agency => {
        const people = covered.filter(candidate => assignment(candidate) === agency.id);
        const percent = candidates.length ? people.length / candidates.length * 100 : 0;
        return <button key={agency.id} type="button" className="agency-network-node" aria-pressed={selected === agency.id} aria-label={`Explore ${agency.name}, ${people.length} assigned candidates`} onClick={() => setSelected(selected === agency.id ? null : agency.id)}>
          <span className="flex items-start justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className="agency-network-icon">{scope === 'local' ? <Building2 /> : <Globe2 />}</span><span className="text-left font-semibold">{agency.name}</span></span><ArrowUpRight className="h-5 w-5 shrink-0 text-primary" /></span>
          <span className="mt-5 flex items-center justify-between gap-3"><span className="flex -space-x-2">{people.slice(0, 3).map(candidate => <CandidateAvatar key={candidate.id} candidate={candidate} className="h-9 w-9 border-2 border-card" />)}{!people.length && <Users className="h-8 w-8 text-muted-foreground" />}</span><span className="text-right"><strong className="block text-2xl">{people.length}</strong><span className="text-xs text-muted-foreground">assigned candidates</span></span></span>
          <span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></span>
        </button>;
      })}
    </div>
    {!matching.length && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{agencies.length ? 'No agencies match this search.' : 'Awaiting the ministry directory. Historical candidate and payment references are preserved.'}</p>}
    {matching.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 6)}>Show more agencies</Button>}
    {selectedAgency && <section className="agency-network-roster" aria-label={`${selectedAgency.name} candidates`}>
      <h3 className="font-semibold">{selectedAgency.name} · {roster.length} candidates</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{roster.slice(0, 12).map(candidate => <Link key={candidate.id} to={`/admin/candidate/${encodeURIComponent(candidate.id)}`} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card/80 p-3 hover:border-primary focus-visible:outline focus-visible:outline-primary"><CandidateAvatar candidate={candidate} className="h-10 w-10 shrink-0" /><span className="min-w-0"><strong className="block truncate text-sm">{candidate.first_name} {candidate.last_name}</strong><span className="text-xs text-muted-foreground">{candidate.home_city || 'Origin pending'}</span></span><ArrowUpRight className="ml-auto h-4 w-4 shrink-0" /></Link>)}</div>
      {!roster.length && <p className="mt-3 text-sm text-muted-foreground">No candidate assignments supplied.</p>}
      {roster.length > 12 && <p className="mt-3 text-sm text-muted-foreground">First 12 of {roster.length}. The full agency roster remains available in Workforce.</p>}
    </section>}
  </section>;
}
