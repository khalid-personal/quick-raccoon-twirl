import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CandidateWorkspaceLink } from './CandidateQuickViewProvider';
import { Search } from 'lucide-react';
import { getCandidates } from '@/lib/data-store';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import type { Candidate } from '@/lib/types';
import CandidateAvatar from '@/components/CandidateAvatar';

const CandidateSemanticSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const { data: candidates = [] } = useQuery<Candidate[]>({ queryKey: ['candidate-profile-search'], queryFn: getCandidates });
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    return candidates.filter(candidate => [
      candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number,
      candidate.country_of_origin, candidate.home_city, candidate.home_region,
      ...(candidate.skills ?? []), ...(candidate.languages ?? []),
    ].some(value => value?.toLocaleLowerCase().includes(term))).slice(0, 8);
  }, [candidates, query]);

  return <Card>
    <CardHeader><CardTitle className="text-base">Candidate profile search</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search candidate profiles" placeholder="Name, tracking code, location or skill" value={query} onChange={event => setQuery(event.target.value)} /></div>
      {query.trim() && <div className="divide-y rounded border">{results.length ? results.map(candidate => <CandidateWorkspaceLink key={candidate.id} candidateId={candidate.id} to={`/admin/candidate/${candidate.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50"><CandidateAvatar candidate={candidate} className="h-9 w-9" /><span className="min-w-0"><span className="font-medium">{candidate.first_name} {candidate.last_name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{candidate.tracking_code}</span><span className="ml-2 text-xs text-muted-foreground">{candidate.country_of_origin}</span></span></CandidateWorkspaceLink>) : <p className="p-3 text-sm text-muted-foreground">No matching profiles.</p>}</div>}
    </CardContent>
  </Card>;
};

export default CandidateSemanticSearch;
