import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck2 } from 'lucide-react';
import CandidateCheckpoint from './CandidateCheckpoint';
import type { CandidateDetail } from '@/lib/types';

interface ContractVisaPanelProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const statusLabel = (available: boolean | undefined): string => available ? 'Received' : 'Not received';

const ContractVisaPanel: React.FC<ContractVisaPanelProps> = ({ candidateDetail }) => {
  const status = candidateDetail.external_status;
  const contractReceived = status?.work_contract ?? candidateDetail.documents.some(document => document.doc_kind === 'work_contract');
  const visaReceived = status?.visa ?? candidateDetail.documents.some(document => document.doc_kind === 'visa');

  return <Card className="overflow-hidden rounded-3xl border-cyan-500/25">
    <CandidateCheckpoint eyebrow="Candidate travel checkpoint" title="Contract and visa" description="Check recorded contract and visa availability before proceeding. Received records do not replace official clearance." icon={FileCheck2} metric={`${Number(contractReceived) + Number(visaReceived)} / 2`} metricLabel="Records received" />
    <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
      <div className={`space-y-3 rounded-2xl border p-5 ${contractReceived ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
        <p className="text-sm font-medium">Work contract</p>
        <Badge variant={contractReceived ? 'default' : 'outline'}>{statusLabel(contractReceived)}</Badge>
      </div>
      <div className={`space-y-3 rounded-2xl border p-5 ${visaReceived ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
        <p className="text-sm font-medium">Work visa</p>
        <Badge variant={visaReceived ? 'default' : 'outline'}>{statusLabel(visaReceived)}</Badge>
      </div>
      {(status?.destination_city || status?.destination_country) && <p className="text-sm text-muted-foreground sm:col-span-2">Destination: {[status.destination_city, status.destination_country].filter(Boolean).join(', ')}</p>}
    </CardContent>
  </Card>;
};

export default ContractVisaPanel;
