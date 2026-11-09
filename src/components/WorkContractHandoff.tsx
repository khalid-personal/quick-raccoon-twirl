import React from 'react';
import { getDocuments } from '@/lib/data-store';
import type { Candidate } from '@/lib/types';
import ContractUpload from './ContractUpload';

interface WorkContractHandoffProps {
  candidate: Candidate;
  onChanged: () => void | Promise<void>;
}

const WorkContractHandoff: React.FC<WorkContractHandoffProps> = ({ candidate, onChanged }) =>
  <ContractUpload candidate={candidate} documents={getDocuments().filter(document => document.candidate_id === candidate.id)} onChanged={onChanged} />;

export default WorkContractHandoff;
