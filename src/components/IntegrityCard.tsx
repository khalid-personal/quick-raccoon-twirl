import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { getApprovalLogs, getCandidates, getDocuments, getIntegrityOverrides, getCandidateStages, getConfig, getMedicalResults, getPaymentStatuses, getPayments, getStaffUsers, getLocalAgencies } from '@/lib/data-store';
import { analyzeIntegrity, applyOverrides, countBySeverity, riskScore, scopeIntegrityFindings } from '@/lib/integrity';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import IntegrityScore from './IntegrityScore';
import { useNavigate } from 'react-router-dom';

const IntegrityCard: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener('supabase-data-changed', bump);
    return () => window.removeEventListener('supabase-data-changed', bump);
  }, []);

  const findings = useMemo(() => scopeIntegrityFindings(applyOverrides(analyzeIntegrity({
    candidates: getCandidates(),
    stages: getCandidateStages(),
    documents: getDocuments(),
    payments: getPayments(),
    paymentStatuses: getPaymentStatuses(),
    medicals: getMedicalResults(),
    logs: getApprovalLogs(),
    stageFees: getConfig().stageFees,
  }), getIntegrityOverrides()).active, getCandidates(), getPayments(), localAgencyId, getStaffUsers()), [version, localAgencyId]);

  const candidateCount = getCandidates().filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId).length;
  const score = riskScore(findings, candidateCount);
  const reviewPath = `/admin/integrity${localAgencyId ? `?agency=${encodeURIComponent(localAgencyId)}` : ''}`;
  const counts = countBySeverity(findings);
  const top = [...findings].sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low'].indexOf(b.severity)).slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {score >= 85 ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
          Records needing review
        </CardTitle>
        <Link to={reviewPath} className="text-sm text-primary hover:underline">Review all</Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">{localAgencyId ? getLocalAgencies().find(agency => agency.id === localAgencyId)?.name ?? 'Selected local agency' : 'All local agencies'}</p>
        {candidateCount ? <IntegrityScore score={score} counts={counts} candidateCount={candidateCount} onReview={() => navigate(reviewPath)} />
          : <p className="text-sm text-muted-foreground">No candidate records for this agency. A score is not available yet.</p>}
        <ul className="space-y-1.5 text-sm">
          {top.length === 0 && <li className="text-muted-foreground">No issues found by the current checks.</li>}
          {top.map(f => (
            <li key={f.id} className="flex gap-2"><Badge variant="outline" className="shrink-0">{f.severity}</Badge><span className="text-muted-foreground">{f.title}: {f.detail}</span></li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default IntegrityCard;
