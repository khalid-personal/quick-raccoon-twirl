import React from 'react';
import CandidateStatusSummary from './CandidateStatusSummary';
import type { CandidateSummary } from '@/lib/types';
import type { CandidateListStatus } from '@/lib/candidate-list-status';

interface RoleCandidateOverviewProps {
  candidates: CandidateSummary[];
  active: CandidateListStatus | null;
  onSelect: (status: CandidateListStatus | null) => void;
}

const RoleCandidateOverview: React.FC<RoleCandidateOverviewProps> = props => <CandidateStatusSummary {...props} />;

export { RoleCandidateOverview };
