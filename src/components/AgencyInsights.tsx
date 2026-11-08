import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import type { CandidateSummary } from '@/lib/types';
import CandidateAvatar from '@/components/CandidateAvatar';

interface AgencyInsightsProps {
  candidates: CandidateSummary[];
  candidateHref: (candidate: CandidateSummary) => string;
  onSelectStatus: (status: CandidateSummary['overall_status'] | '') => void;
}

const AgencyInsights: React.FC<AgencyInsightsProps> = ({ candidates, candidateHref, onSelectStatus }) => {
  const attention = candidates.filter(candidate => candidate.overall_status === 'Blocked').slice(0, 4);
  return <Card>
    <CardHeader><CardTitle className="text-base">Follow-up queue</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {attention.length ? attention.map(candidate => <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
        <div className="flex items-center gap-2"><CandidateAvatar candidate={candidate} className="h-9 w-9" /><div><p className="font-medium">{candidate.first_name} {candidate.last_name}</p><p className="text-xs text-muted-foreground">{candidate.tracking_code} · {candidate.overall_status}</p></div></div>
        <Button asChild size="sm" variant="outline"><Link to={candidateHref(candidate)}>Review <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </div>) : <p className="text-sm text-muted-foreground">No blocked candidates in your current pipeline.</p>}
      <Button type="button" variant="ghost" size="sm" onClick={() => onSelectStatus('Blocked')}>Show blocked candidates</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => onSelectStatus('')}>Clear status filter</Button>
    </CardContent>
  </Card>;
};

export default AgencyInsights;
