import React, { useState } from 'react';
import { getCandidates, saveCandidates } from '@/lib/data-store';
import type { Candidate } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import CandidateAvatar from '@/components/CandidateAvatar';

const ExternalSystemSimulator: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>(() => getCandidates());
  const update = (id: string, patch: Partial<NonNullable<Candidate['external_status']>>) => {
    const updated = candidates.map(candidate => candidate.id === id ? {
      ...candidate,
      external_status: { ...candidate.external_status, ...patch, updated_at: new Date().toISOString() },
    } : candidate);
    setCandidates(updated);
    saveCandidates(updated);
  };

  return <Card>
    <CardHeader><CardTitle className="text-base">External contract and visa status</CardTitle><p className="text-sm text-muted-foreground">Simulate document updates received from the external employment system.</p></CardHeader>
    <CardContent className="space-y-4">
      {candidates.length ? candidates.slice(0, 10).map(candidate => <section key={candidate.id} className="grid gap-3 border-b pb-4 last:border-0 sm:grid-cols-[minmax(150px,1fr)_auto_auto_minmax(130px,1fr)] sm:items-center">
        <div className="flex items-center gap-2"><CandidateAvatar candidate={candidate} className="h-9 w-9" /><div><p className="font-medium">{candidate.first_name} {candidate.last_name}</p><p className="text-xs text-muted-foreground">{candidate.tracking_code}</p></div></div>
        <div className="flex items-center gap-2"><Switch id={`contract-${candidate.id}`} checked={!!candidate.external_status?.work_contract} onCheckedChange={work_contract => update(candidate.id, { work_contract })} /><Label htmlFor={`contract-${candidate.id}`}>Contract</Label></div>
        <div className="flex items-center gap-2"><Switch id={`visa-${candidate.id}`} checked={!!candidate.external_status?.visa} onCheckedChange={visa => update(candidate.id, { visa })} /><Label htmlFor={`visa-${candidate.id}`}>Visa</Label></div>
        <div className="space-y-1"><Label className="text-xs" htmlFor={`destination-${candidate.id}`}>Destination</Label><Input id={`destination-${candidate.id}`} value={[candidate.external_status?.destination_city, candidate.external_status?.destination_country].filter(Boolean).join(', ')} placeholder="City, country" onBlur={event => {
          const [destination_city = '', destination_country = ''] = event.target.value.split(',').map(value => value.trim());
          update(candidate.id, { destination_city, destination_country });
        }} /></div>
        <Badge className="w-fit" variant="outline">{candidate.external_status?.updated_at ? 'Updated' : 'No external update'}</Badge>
      </section>) : <p className="text-sm text-muted-foreground">No candidate records available.</p>}
    </CardContent>
  </Card>;
};

export default ExternalSystemSimulator;
