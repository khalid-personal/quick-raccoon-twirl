import React from 'react';
import { Check, FileCheck2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { getCandidates, saveCandidates } from '@/lib/data-store';
import type { Candidate, WorkContractRecord } from '@/lib/types';
import { hasCompleteCandidateIntroduction } from '@/lib/candidate-introduction';

interface WorkContractHandoffProps {
  candidate: Candidate;
  onChanged: () => void | Promise<void>;
}

const WorkContractHandoff: React.FC<WorkContractHandoffProps> = ({ candidate, onChanged }) => {
  const record = candidate.work_contract_record;
  const introductionComplete = hasCompleteCandidateIntroduction(candidate);
  const update = async (status: WorkContractRecord['status']) => {
    if (status === 'sent' && !introductionComplete) {
      toast.error('Complete the candidate gender, introduction, skills, languages, and video before sending a work contract.');
      return;
    }
    const candidates = getCandidates();
    const index = candidates.findIndex(item => item.id === candidate.id);
    if (index < 0) return toast.error('Candidate record was not found.');
    const next: WorkContractRecord = {
      ...candidates[index].work_contract_record,
      status,
      ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
      ...(status === 'received' ? { received_at: new Date().toISOString() } : {}),
    };
    candidates[index] = { ...candidates[index], work_contract_record: next, updated_at: new Date().toISOString() };
    saveCandidates(candidates);
    toast.success(`Work contract marked ${status}.`);
    await onChanged();
  };

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
      <CardTitle className="text-base">Work contract handoff</CardTitle>
      <Badge variant={record?.status === 'received' ? 'default' : 'outline'}>{record?.status ?? 'not-sent'}</Badge>
    </CardHeader>
    <CardContent className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={record?.status === 'sent' || !introductionComplete} onClick={() => void update('sent')}><Send className="mr-2 h-4 w-4" />Mark sent</Button>
      <Button size="sm" variant="outline" disabled={!record || record.status === 'received'} onClick={() => void update('received')}><Check className="mr-2 h-4 w-4" />Confirm received</Button>
      <Button size="sm" variant="outline" disabled={!record || record.status === 'rejected'} onClick={() => void update('rejected')}><X className="mr-2 h-4 w-4" />Reject</Button>
      {record?.url && <Button asChild size="sm" variant="ghost"><a href={record.url} target="_blank" rel="noreferrer"><FileCheck2 className="mr-2 h-4 w-4" />Open contract</a></Button>}
      {!introductionComplete && <p className="w-full text-xs text-amber-700">Complete the required candidate profile details before sending a contract.</p>}
    </CardContent>
  </Card>;
};

export default WorkContractHandoff;
