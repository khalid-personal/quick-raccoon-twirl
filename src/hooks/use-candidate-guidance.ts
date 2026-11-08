import { useEffect, useMemo, useState } from 'react';
import type { Candidate } from '@/lib/types';
import { usePortalData } from './use-portal-data';
import { getApprovalLogs, getDocuments, getIntegrityOverrides, getLocalAgencies, getMedicalResults } from '@/lib/data-store';
import { buildCandidateGuidance } from '@/lib/candidate-guidance';
import { useAuth } from '@/lib/auth-context';
import { loadBankStatement } from '@/lib/bank-statement-store';
import { candidatePaymentReview } from '@/lib/candidate-payment-review';

export const useCandidateGuidance = (candidates: Candidate[]) => {
  const data = usePortalData();
  const { userRole, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [bankStatements, setBankStatements] = useState(() => new Map(getLocalAgencies().map(agency => [agency.id, loadBankStatement(agency.id, 'candidate')])));
  useEffect(() => {
    const refresh = () => setBankStatements(new Map(getLocalAgencies().map(agency => [agency.id, loadBankStatement(agency.id, 'candidate')])));
    refresh();
    window.addEventListener('bank-statement-changed', refresh);
    return () => window.removeEventListener('bank-statement-changed', refresh);
  }, [data.locals]);
  return useMemo(() => {
    const scoped = data.candidates.filter(candidate => {
      if (userRole === 'local-agency') return candidate.local_agency_id === userLocalAgencyId;
      if (['foreign-agency', 'foreign-agency-staff', 'agency'].includes(userRole ?? '')) return candidate.foreign_agency_id === userForeignAgencyId
        || candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId);
      return true;
    });
    const subjects = data.candidates.length ? scoped : candidates;
    const ids = new Set(subjects.map(candidate => candidate.id));
    const guidance = buildCandidateGuidance({
      candidates: subjects, stages: data.stages.filter(stage => ids.has(stage.candidate_id)),
      payments: data.payments.filter(payment => payment.candidate_ids.some(id => ids.has(id))),
      paymentStatuses: data.paymentStatuses.filter(payment => ids.has(payment.candidateId)),
      medicals: getMedicalResults().filter(medical => ids.has(medical.candidate_id)),
      documents: getDocuments().filter(document => ids.has(document.candidate_id)),
      logs: getApprovalLogs(), stageFees: data.stageFees,
    }, getIntegrityOverrides());
    candidatePaymentReview(subjects, data.stages, data.payments, data.stageFees, bankStatements).forEach((review, id) => {
      const entry = guidance.get(id);
      if (entry) entry.paymentReview = review;
    });
    return guidance;
  }, [candidates, data, userRole, userLocalAgencyId, userForeignAgencyId, bankStatements]);
};
