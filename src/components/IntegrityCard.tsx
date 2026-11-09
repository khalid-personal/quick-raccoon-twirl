import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ScanLine, ShieldCheck } from 'lucide-react';
import { getApprovalLogs, getCandidates, getDocuments, getIntegrityOverrides, getCandidateStages, getConfig, getMedicalResults, getPaymentStatuses, getPayments, getStaffUsers, getLocalAgencies } from '@/lib/data-store';
import { analyzeIntegrity, applyOverrides, countBySeverity, riskScore, scopeIntegrityFindings, getIntegrityScoreLevel, type Severity } from '@/lib/integrity';
import { practiceRecordLabel } from '@/lib/practice-record-label';
import { isDemoMode } from '@/lib/demo-mode';
import { Button } from './ui/button';
import FindingInvestigation from './FindingInvestigation';
import CandidateAvatar from './CandidateAvatar';
import { CandidateWorkspaceLink } from './CandidateQuickViewProvider';

const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
export default function IntegrityCard({ localAgencyId }: { localAgencyId?: string }) {
  const [version, setVersion] = useState(0);
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    const events = ['supabase-data-changed', 'storage', 'bank-statement-changed', 'agency-resolution-changed'];
    events.forEach(event => window.addEventListener(event, refresh));
    return () => events.forEach(event => window.removeEventListener(event, refresh));
  }, []);
  const snapshot = useMemo(() => {
    const candidates = getCandidates(), payments = getPayments();
    const findings = scopeIntegrityFindings(applyOverrides(analyzeIntegrity({
      candidates, payments, stages: getCandidateStages(), documents: getDocuments(),
      paymentStatuses: getPaymentStatuses(), medicals: getMedicalResults(), logs: getApprovalLogs(), stageFees: getConfig().stageFees,
    }), getIntegrityOverrides()).active, candidates, payments, localAgencyId, getStaffUsers());
    return { candidates: candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId), findings, version };
  }, [version, localAgencyId]);
  const counts = countBySeverity(snapshot.findings);
  const score = riskScore(snapshot.findings, snapshot.candidates.length);
  const level = getIntegrityScoreLevel(score, getConfig().integrityScoreThresholds);
  const color = level === 'green' ? '#c8f575' : level === 'yellow' ? '#f5c66b' : '#fb8c9c';
  const filtered = snapshot.findings.filter(finding => severity === 'all' || finding.severity === severity)
    .sort((a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 2) - 1));
  const reviewPath = `/admin/integrity${localAgencyId ? `?agency=${encodeURIComponent(localAgencyId)}` : ''}`;
  const affected = new Set(snapshot.findings.flatMap(finding => finding.candidateId ? [finding.candidateId] : [])).size;
  return <section aria-label="Records needing review" className="record-check-console overflow-hidden rounded-3xl border bg-card shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3 p-5 pb-2"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><ScanLine className="h-4 w-4" />Evidence intelligence</p><h2 className="mt-2 text-2xl font-semibold">Records needing review</h2></div><Link to={reviewPath} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Review all <ArrowUpRight className="h-4 w-4" /></Link></header>
    <p className="px-5 text-sm text-muted-foreground">Inspect the signals behind the score. Choose a severity, open a candidate, or review an issue with its evidence. A warning is not proof of wrongdoing.</p>
    <div className="record-check-display m-5 rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-5">
        <div className="record-check-dial" style={{ background: snapshot.candidates.length ? `conic-gradient(${color} ${score}%, #ffffff18 0)` : '#ffffff18' }} aria-label={snapshot.candidates.length ? `Record check score ${score} out of 100` : 'No record check score available'}><div><p className="text-4xl font-semibold tabular-nums">{snapshot.candidates.length ? score : '—'}</p><span className="text-xs">record check score</span></div></div>
        <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-white/65">{localAgencyId ? getLocalAgencies().find(agency => agency.id === localAgencyId)?.name ?? 'Selected local agency' : 'All local agencies'}</p><h3 className="mt-2 text-2xl font-semibold">{!snapshot.candidates.length ? 'Awaiting records' : !snapshot.findings.length ? 'No current warning signals' : level === 'green' ? 'Strong coverage. Inspect exceptions.' : 'Focus where evidence needs work.'}</h3><p className="mt-2 text-sm text-white/70">{snapshot.candidates.length} candidate records · {affected} with candidate-linked warnings</p></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/15 p-3"><p className="text-2xl font-semibold">{snapshot.findings.length}</p><p className="text-xs text-white/70">warning signals · not unique records</p></div><div className="rounded-xl border border-white/15 p-3"><p className="text-2xl font-semibold">{counts.critical + counts.high}</p><p className="text-xs text-white/70">critical / high signals to prioritize</p></div></div>
    </div>
    <div className="grid grid-cols-2 gap-2 px-5 sm:grid-cols-4" role="group" aria-label="Warning severity lens">{severities.map(value => <button type="button" key={value} className="record-severity-node min-w-0 rounded-xl border p-3 text-left" data-severity={value} aria-pressed={severity === value} onClick={() => { setSeverity(previous => previous === value ? 'all' : value); setPage(0); }}><span className="text-xs font-semibold capitalize">{value}</span><strong className="mt-1 block text-2xl tabular-nums">{counts[value]}</strong><span className="record-severity-bar mt-2 block h-1 rounded-full" style={{ width: `${snapshot.findings.length ? Math.max(5, counts[value] / snapshot.findings.length * 100) : 0}%` }} /></button>)}</div>
    <div className="space-y-3 p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{severity === 'all' ? 'Highest-priority signals' : `${severity[0].toUpperCase()}${severity.slice(1)} signals`}</h3><Button size="sm" variant="ghost" disabled={severity === 'all'} onClick={() => { setSeverity('all'); setPage(0); }}>All severities</Button></div>
      {filtered.slice(currentPage * 2, currentPage * 2 + 2).map(finding => {
        const candidate = snapshot.candidates.find(candidate => candidate.id === finding.candidateId);
        return <article key={finding.id} className="space-y-3 rounded-xl border bg-background/60 p-4">
          <div className="flex items-start gap-3">{candidate && <CandidateAvatar candidate={candidate} className="h-10 w-10 shrink-0" />}<div className="min-w-0"><p className="text-xs font-semibold capitalize text-muted-foreground">{finding.severity} · {candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Agency / operator evidence'}</p><h4 className="mt-1 text-sm font-semibold">{finding.title}</h4><p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">{practiceRecordLabel(finding.detail, isDemoMode())}</p></div></div>
          <div className="flex flex-wrap gap-2"><FindingInvestigation finding={finding} />{candidate && <Button size="sm" variant="ghost" asChild><CandidateWorkspaceLink candidateId={candidate.id} to={`/admin/candidate/${candidate.id}`}>Open candidate <ArrowUpRight className="ml-1 h-4 w-4" /></CandidateWorkspaceLink></Button>}</div>
        </article>;
      })}
      {!filtered.length && <p className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />{!snapshot.candidates.length ? 'No candidate records in this scope. A score cannot be inferred.' : 'No current warnings in this lens. This does not certify identity, payments or travel clearance.'}</p>}
      {filtered.length > 2 && <div className="flex items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-xs text-muted-foreground">{currentPage * 2 + 1}–{Math.min(currentPage * 2 + 2, filtered.length)} of {filtered.length}</span><Button size="sm" variant="outline" disabled={(currentPage + 1) * 2 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next signals</Button></div>}
      <p className="text-xs text-muted-foreground">Higher scores mean fewer current warnings. Resolve with evidence; closing an investigation records an exception, not a repair or agency reinstatement.</p>
    </div>
  </section>;
}
