import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck2 } from 'lucide-react';
import CandidateCheckpoint from './CandidateCheckpoint';
import type { CandidateDetail } from '@/lib/types';
import ContractUpload from './ContractUpload';

interface ContractVisaPanelProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const statusLabel = (available: boolean | undefined): string => available ? 'Received' : 'Not received';

const ContractVisaPanel: React.FC<ContractVisaPanelProps> = ({ candidateDetail, refetch }) => {
  const status = candidateDetail.external_status;
  const contractReceived = candidateDetail.work_contract_record ? candidateDetail.work_contract_record.status === 'received' : status?.work_contract === true;
  const visaReceived = candidateDetail.documents.some(document => document.doc_kind === 'visa') || status?.visa === true;

  return <Card className="overflow-hidden rounded-3xl border-primary/20">
    <CandidateCheckpoint eyebrow="Agency evidence" title="Contract intelligence and visa evidence" description="Review the agency-submitted contract and source document receipts. A saved document is not ministry clearance." icon={FileCheck2} metric={`${Number(contractReceived) + Number(visaReceived)} / 2`} metricLabel="Records received" />
    <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
      <div className={`space-y-3 rounded-2xl border p-5 ${contractReceived ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
        <p className="text-sm font-medium">Work contract</p>
        <Badge variant={contractReceived ? 'default' : 'outline'}>{candidateDetail.work_contract_record?.status === 'sent' ? 'Submitted · awaiting receipt' : statusLabel(contractReceived)}</Badge>
      </div>
      <div className={`space-y-3 rounded-2xl border p-5 ${visaReceived ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
        <p className="text-sm font-medium">Work visa</p>
        <Badge variant={visaReceived ? 'default' : 'outline'}>{statusLabel(visaReceived)}</Badge>
      </div>
      {(status?.destination_city || status?.destination_country) && <p className="text-sm text-muted-foreground sm:col-span-2">Destination: {[status.destination_city, status.destination_country].filter(Boolean).join(', ')}</p>}
      <div className="min-w-0 sm:col-span-2"><ContractUpload candidate={candidateDetail} documents={candidateDetail.documents} onChanged={refetch} /></div>
    </CardContent>
  </Card>;
};

export default ContractVisaPanel;
