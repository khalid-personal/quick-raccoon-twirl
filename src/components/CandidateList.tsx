import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CandidateSortField, CandidateSummary, SortDirection } from '@/lib/types';
import { presenceFor, type PresenceSnapshot } from '@/lib/presence';
import { LastOnline } from '@/components/LastOnline';
import CandidateAvatar from '@/components/CandidateAvatar';
import CandidateRowActions from './CandidateRowActions';
import { useCandidateGuidance } from '@/hooks/use-candidate-guidance';
import { candidateListStatus } from '@/lib/candidate-list-status';
import { Progress } from '@/components/ui/progress';
import { EntityProfileButton, useCandidateWorkspace } from './CandidateQuickViewProvider';

interface CandidateListProps {
  candidates: CandidateSummary[];
  basePath: string;
  sortBy: CandidateSortField;
  direction: SortDirection;
  presence?: PresenceSnapshot;
  onSort: (field: CandidateSortField) => void;
}

const CandidateList: React.FC<CandidateListProps> = ({ candidates, basePath, sortBy, direction, presence, onSort }) => {
  const guidance = useCandidateGuidance(candidates);
  const openCandidate = useCandidateWorkspace();
  const heading = (label: string, field: CandidateSortField) => <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 gap-1" onClick={() => onSort(field)}>
    {label}{sortBy !== field ? <ArrowUpDown className="h-3.5 w-3.5" /> : direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
  </Button>;

  return <Table>
    <TableHeader><TableRow>
      <TableHead>{heading('Candidate', 'first_name')}</TableHead>
      <TableHead>{heading('Tracking code', 'tracking_code')}</TableHead>
      <TableHead>Gender</TableHead>
      <TableHead>{heading('Progress', 'progress_percent')}</TableHead>
      <TableHead>Candidate activity</TableHead>
      <TableHead>{heading('Status', 'overall_status')}</TableHead>
      <TableHead>{heading('Local agency', 'local_agency_name')}</TableHead>
      <TableHead>{heading('Foreign agency', 'foreign_agency_name')}</TableHead>
      <TableHead>Profile / passport / integrity</TableHead>
    </TableRow></TableHeader>
    <TableBody>{candidates.map(candidate => {
      const state = presence ? presenceFor(presence, 'candidate', candidate.id) : { online: false, lastSeen: undefined };
      return <TableRow key={candidate.id}>
      <TableCell>{openCandidate ? <button type="button" className="flex items-center gap-2 text-left font-medium hover:text-primary hover:underline" onClick={() => openCandidate(candidate.id)}><CandidateAvatar candidate={candidate} className="h-9 w-9" /><span>{candidate.first_name} {candidate.last_name}</span></button> : <Link className="flex items-center gap-2 font-medium underline-offset-4 hover:underline" to={`${basePath}/${candidate.id}`}><CandidateAvatar candidate={candidate} className="h-9 w-9" /><span>{candidate.first_name} {candidate.last_name}</span></Link>}</TableCell>
      <TableCell className="font-mono text-xs">{candidate.tracking_code}</TableCell>
      <TableCell className="capitalize">{candidate.gender || 'Not recorded'}</TableCell>
      <TableCell className="min-w-28 tabular-nums"><div className="space-y-1"><span className="text-xs">{Math.round(candidate.progress_percent)}%</span><Progress value={candidate.progress_percent} className="h-1.5" /></div></TableCell>
      <TableCell><LastOnline at={state.lastSeen} online={state.online} /></TableCell>
      <TableCell><Badge variant={candidateListStatus(candidate) === 'failed' ? 'destructive' : 'outline'}>{({ inProgress: 'In progress', pendingQr: 'Pending ministry QR', completed: 'Completed', failed: 'Failed' })[candidateListStatus(candidate)]}</Badge></TableCell>
      <TableCell><EntityProfileButton kind="local-agency" entityId={candidate.local_agency_id}>{candidate.local_agency_name || '—'}</EntityProfileButton></TableCell>
      <TableCell><EntityProfileButton kind="foreign-agency" entityId={candidate.foreign_agency_id}>{candidate.foreign_agency_name || '—'}</EntityProfileButton></TableCell>
      <TableCell><CandidateRowActions candidate={candidate} profilePath={`${basePath}/${candidate.id}`} guidance={guidance.get(candidate.id)} /></TableCell>
    </TableRow>;
    })}</TableBody>
  </Table>;
};

export default CandidateList;
