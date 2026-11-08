import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getCandidates, getLocalAgencies } from '@/lib/data-store';
import PageHeader from '@/components/page/PageHeader';
import StatCards from '@/components/page/StatCards';
import FilterBar from '@/components/page/FilterBar';
import CandidateAvatar from '@/components/CandidateAvatar';
import CandidateIntroductionMedia from '@/components/CandidateIntroductionMedia';
import WorkContractHandoff from '@/components/WorkContractHandoff';
import { hasCompleteCandidateIntroduction } from '@/lib/candidate-introduction';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Film, FileCheck2, Users } from 'lucide-react';

const FILTERS = ['all', 'video', 'needs-intro', 'contract-sent', 'contract-received'] as const;
type Filter = typeof FILTERS[number];

const AgencyCandidateIntroductions: React.FC = () => {
  const { userForeignAgencyId, userForeignAgencyName } = useAuth();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    window.addEventListener('supabase-data-changed', refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { window.removeEventListener('supabase-data-changed', refresh); window.clearInterval(timer); };
  }, []);

  const candidates = getCandidates().filter(candidate =>
    !!userForeignAgencyId && (candidate.foreign_agency_id === userForeignAgencyId
      || candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)),
  );
  const withVideo = candidates.filter(candidate => !!candidate.intro_video_url);
  const needingIntro = candidates.filter(candidate => !hasCompleteCandidateIntroduction(candidate));
  const contractSent = candidates.filter(candidate => candidate.work_contract_record?.status === 'sent');
  const contractReceived = candidates.filter(candidate => candidate.work_contract_record?.status === 'received');
  const query = search.trim().toLowerCase();
  const rows = candidates.filter(candidate => {
    const content = `${candidate.first_name} ${candidate.last_name} ${candidate.tracking_code} ${candidate.professional_summary ?? ''} ${(candidate.skills ?? []).join(' ')} ${(candidate.languages ?? []).join(' ')}`.toLowerCase();
    if (query && !content.includes(query)) return false;
    if (filter === 'video') return !!candidate.intro_video_url;
    if (filter === 'needs-intro') return !hasCompleteCandidateIntroduction(candidate);
    if (filter === 'contract-sent') return candidate.work_contract_record?.status === 'sent';
    if (filter === 'contract-received') return candidate.work_contract_record?.status === 'received';
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Introductions"
        description={`Review ${userForeignAgencyName ?? 'your agency’s'} candidate profiles and introduction videos before sending a work contract.`}
      />
      <StatCards items={[
        { label: 'Assigned candidates', value: candidates.length, icon: <Users className="h-4 w-4" />, onClick: () => setFilter('all'), active: filter === 'all' },
        { label: 'Video available', value: withVideo.length, icon: <Film className="h-4 w-4" />, onClick: () => setFilter(filter === 'video' ? 'all' : 'video'), active: filter === 'video' },
        { label: 'Introduction needed', value: needingIntro.length, icon: <Film className="h-4 w-4 text-amber-600" />, onClick: () => setFilter(filter === 'needs-intro' ? 'all' : 'needs-intro'), active: filter === 'needs-intro' },
        { label: 'Contract received', value: contractReceived.length, icon: <FileCheck2 className="h-4 w-4 text-emerald-600" />, onClick: () => setFilter(filter === 'contract-received' ? 'all' : 'contract-received'), active: filter === 'contract-received' },
      ]} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search name, tracking code, skills, or languages" />
        <ToggleGroup navigation type="single" value={filter} onValueChange={value => { if (FILTERS.includes(value as Filter)) setFilter(value as Filter); }} aria-label="Filter candidate introductions">
          <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
          <ToggleGroupItem value="video" size="sm">Video available</ToggleGroupItem>
          <ToggleGroupItem value="needs-intro" size="sm">Needs details</ToggleGroupItem>
          <ToggleGroupItem value="contract-sent" size="sm">Contract sent</ToggleGroupItem>
          <ToggleGroupItem value="contract-received" size="sm">Received</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-xs text-muted-foreground">Profile videos are shared by the Ethiopian agency through a secure video link. Review candidate details before sending a contract.</p>

      {rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No candidate introductions match this filter.</CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(candidate => (
            <Card key={candidate.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CandidateAvatar candidate={candidate} className="h-12 w-12" />
                  <div className="min-w-0"><CardTitle className="truncate text-base">{candidate.first_name} {candidate.last_name}</CardTitle><p className="font-mono text-xs text-muted-foreground">{candidate.tracking_code}</p></div>
                </div>
                <Badge variant={candidate.work_contract_record?.status === 'received' ? 'default' : candidate.work_contract_record?.status === 'sent' ? 'secondary' : 'outline'}>
                  {candidate.work_contract_record?.status === 'received' ? 'Contract received' : candidate.work_contract_record?.status === 'sent' ? 'Contract sent' : 'No contract sent'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-5">
                <CandidateIntroductionMedia candidate={candidate} compact />
                <WorkContractHandoff candidate={candidate} onChanged={() => setVersion(value => value + 1)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgencyCandidateIntroductions;
