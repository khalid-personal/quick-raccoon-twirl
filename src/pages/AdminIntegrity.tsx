import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, CheckCircle2, Download, Eye, Info, Loader2, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getApprovalLogs, getCandidates, getDocuments, getIntegrityOverrides, getStaffUsers, getCandidateStages, getConfig, getMedicalResults, getPaymentStatuses, getPayments } from '@/lib/data-store';
import { analyzeIntegrity, applyOverrides, countBySeverity, riskScore } from '@/lib/integrity';
import { MIN_OVERRIDE_REASON, overrideFinding, revokeOverride } from '@/lib/integrity-overrides';
import type { Finding, Severity } from '@/lib/integrity';
import { buildElmisCsv, getElmisMode, verifyCandidateWithElmis } from '@/lib/elmis';
import type { Candidate } from '@/lib/types';
import ControlRoomHeader from '@/components/ControlRoomHeader';
import StatCards from '@/components/page/StatCards';
import FilterBar from '@/components/page/FilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CandidateAvatar from '@/components/CandidateAvatar';
import IntegrityScore from '@/components/IntegrityScore';
import { useCandidateWorkspace } from '@/components/CandidateQuickViewProvider';
import AgencyResolutionCenter from '@/components/AgencyResolutionCenter';
import FindingInvestigation from '@/components/FindingInvestigation';

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
  medium: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  low: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const ELMIS_STYLE: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  mismatch: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
  not_found: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  error: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  pending: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const downloadFile = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const useDataVersion = () => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener('supabase-data-changed', bump);
    return () => window.removeEventListener('supabase-data-changed', bump);
  }, []);
  return version;
};

const AdminIntegrity: React.FC = () => {
  const openCandidate = useCandidateWorkspace();
  const { user, userRole } = useAuth();
  const canOverride = userRole === 'superadmin';
  const isAuditor = userRole === 'auditor';
  const version = useDataVersion();
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('findings');
  const [mode, setMode] = useState<'live' | 'sandbox' | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<Finding | null>(null);
  const [reason, setReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideVersion, setOverrideVersion] = useState(0);
  const [auditScope, setAuditScope] = useState<'all' | 'superadmin'>(isAuditor ? 'superadmin' : 'all');

  useEffect(() => { void getElmisMode().then(setMode); }, []);

  const candidates = useMemo(() => getCandidates(), [version, checking, bulkRunning]);
  const allFindings = useMemo(() => analyzeIntegrity({
    candidates,
    stages: getCandidateStages(),
    documents: getDocuments(),
    payments: getPayments(),
    paymentStatuses: getPaymentStatuses(),
    medicals: getMedicalResults(),
    logs: getApprovalLogs(),
    stageFees: getConfig().stageFees,
  }), [candidates, version, overrideVersion]);
  const overrides = useMemo(() => getIntegrityOverrides(), [version, overrideVersion]);
  const { active: findings, overridden } = useMemo(() => applyOverrides(allFindings, overrides), [allFindings, overrides]);

  const counts = countBySeverity(findings);
  const score = riskScore(findings, candidates.length);
  const candidateName = (id?: string) => {
    const c = candidates.find(item => item.id === id);
    return c ? `${c.first_name} ${c.last_name}` : undefined;
  };

  const visible = findings
    .filter(f => severity === 'all' || f.severity === severity)
    .filter(f => {
      const query = search.trim().toLowerCase();
      return !query || `${f.title} ${f.detail} ${candidateName(f.candidateId) ?? ''}`.toLowerCase().includes(query);
    })
    .sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low'].indexOf(b.severity));

  const logs = useMemo(() => {
    const superadmins = new Set(getStaffUsers().filter(u => u.role === 'superadmin').map(u => u.email.toLowerCase()));
    const all = [...getApprovalLogs()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const scoped = auditScope === 'superadmin' ? all.filter(l => superadmins.has(l.actor_email.toLowerCase())) : all;
    return scoped.slice(0, 200);
  }, [version, overrideVersion, auditScope]);

  const actor = { id: user?.id ?? '', email: user?.email ?? '' };
  const submitOverride = async () => {
    if (!overrideTarget) return;
    setSavingOverride(true);
    try {
      await overrideFinding(overrideTarget, reason, actor);
      toast.success('Flag overridden and recorded in the audit trail.');
      setOverrideTarget(null);
      setReason('');
      setOverrideVersion(v => v + 1);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingOverride(false);
    }
  };
  const revoke = async (id: string) => {
    await revokeOverride(id, actor);
    toast.success('Exception cancelled. The warning is active again.');
    setOverrideVersion(v => v + 1);
  };

  const verifyOne = async (candidate: Candidate) => {
    if (!user) return;
    setChecking(candidate.id);
    try {
      const record = await verifyCandidateWithElmis(candidate, { id: user.id ?? '', email: user.email ?? '' });
      toast[record.status === 'verified' ? 'success' : 'warning'](`${candidate.first_name}: ELMIS ${record.status.replace('_', ' ')}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const verifyAll = async () => {
    if (!user) return;
    setBulkRunning(true);
    try {
      for (const candidate of candidates.filter(c => c.elmis?.status !== 'verified')) {
        await verifyCandidateWithElmis(candidate, { id: user.id ?? '', email: user.email ?? '' });
      }
      toast.success('ELMIS check finished.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBulkRunning(false);
    }
  };

  const verified = candidates.filter(c => c.elmis?.status === 'verified').length;

  return (
    <div className="space-y-6">
      <ControlRoomHeader
        scope={isAuditor ? 'Auditor · view only' : 'Administration · record checks'}
        description={isAuditor ? 'Review warnings, approved exceptions and activity history. You can view these records but cannot change them.' : 'Find missing or conflicting candidate and payment details. Check identity records against the Ethiopian Labour Market Information System (ELMIS).'}
        title={isAuditor ? 'Record review' : 'Record checks'}
        icon={ShieldAlert}
        actions={isAuditor ? <Badge variant="outline" className="gap-1 !border-white/30 !text-white"><Eye className="h-3.5 w-3.5" />Read-only</Badge> : <Button variant="outline" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10" onClick={() => downloadFile('integrity-findings.csv', ['severity,rule,title,detail', ...findings.map(f => [f.severity, f.rule, f.title, f.detail].map(v => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n'))}><Download className="mr-2 h-4 w-4" />Export findings</Button>}
      />

      <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
        <IntegrityScore score={score} counts={counts} candidateCount={candidates.length} onReview={() => { setSeverity(counts.critical ? 'critical' : counts.high ? 'high' : 'all'); setActiveTab('findings'); }} />
        <StatCards items={[
          { label: 'Critical', value: counts.critical, icon: <AlertOctagon className="h-5 w-5 text-red-600" />, onClick: () => { setSeverity(severity === 'critical' ? 'all' : 'critical'); setActiveTab('findings'); }, active: severity === 'critical' },
          { label: 'High', value: counts.high, icon: <AlertTriangle className="h-5 w-5 text-orange-600" />, onClick: () => { setSeverity(severity === 'high' ? 'all' : 'high'); setActiveTab('findings'); }, active: severity === 'high' },
          { label: 'Medium', value: counts.medium, icon: <Info className="h-5 w-5 text-amber-600" />, onClick: () => { setSeverity(severity === 'medium' ? 'all' : 'medium'); setActiveTab('findings'); }, active: severity === 'medium' },
          { label: 'Low', value: counts.low, icon: <Info className="h-5 w-5 text-slate-500" />, onClick: () => { setSeverity(severity === 'low' ? 'all' : 'low'); setActiveTab('findings'); }, active: severity === 'low' },
        ]} />
      </div>

      {canOverride && <AgencyResolutionCenter />}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="findings">Issues to review ({findings.length})</TabsTrigger>
          <TabsTrigger value="overrides">Accepted exceptions ({overrides.filter(o => !o.revoked_at).length})</TabsTrigger>
          {!isAuditor && <TabsTrigger value="elmis">Identity checks (ELMIS)</TabsTrigger>}
          <TabsTrigger value="audit">Activity history</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search findings or candidates"
            filters={[['all', 'All'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]}
            filter={severity}
            onFilterChange={setSeverity}
          />
          <Card>
            <CardContent className="pt-6">
              {visible.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />No issues match this selection.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Severity</TableHead><TableHead>Finding</TableHead><TableHead>Details</TableHead><TableHead>Open</TableHead>{canOverride && <TableHead className="text-right">Action</TableHead>}</TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((f: Finding) => (
                        <TableRow key={f.id}>
                          <TableCell><Badge variant="outline" className={SEVERITY_STYLE[f.severity]}>{f.severity}</Badge></TableCell>
                          <TableCell className="font-medium">{f.title}</TableCell>
                          <TableCell className="max-w-[520px] text-sm text-muted-foreground">{f.detail}</TableCell>
                          <TableCell>
                            {!isAuditor && <FindingInvestigation finding={f} />}
                            {f.candidateId && !isAuditor && (openCandidate ? <Button size="sm" variant="outline" onClick={() => openCandidate(f.candidateId!, { tab: f.rule.includes('payment') ? 'payments' : 'profile' })}>Review {candidateName(f.candidateId) ?? 'candidate'}</Button> : <Link className="text-sm text-primary hover:underline" to={`/admin/candidate/${f.candidateId}`}>{candidateName(f.candidateId) ?? 'Candidate'}</Link>)}
                            {f.candidateId && isAuditor && <span className="text-sm">{candidateName(f.candidateId)}</span>}
                            {f.paymentId && !isAuditor && <Link className="text-sm text-primary hover:underline" to="/admin/payments">Payment</Link>}
                            {f.paymentId && isAuditor && <span className="text-sm">Payment</span>}
                            {f.actor && <span className="text-sm">{f.actor}</span>}
                          </TableCell>
                          {canOverride && <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setOverrideTarget(f); setReason(''); }}>Accept an exception</Button></TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides">
          <Card>
            <CardHeader>
              <CardTitle>Accepted exceptions</CardTitle>
              <CardDescription>
                {canOverride ? 'Warnings accepted with a saved reason no longer count toward the score. This does not mean the issue was fixed. Auditors can review every decision.' : 'Warnings accepted by the superadmin. Review each reason. Accepting an exception does not delete the original record or prove the issue was fixed.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overrides.length === 0 ? <p className="text-sm text-muted-foreground">No exceptions have been accepted.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Severity</TableHead><TableHead>Flag</TableHead><TableHead>Reason</TableHead><TableHead>By</TableHead><TableHead>When</TableHead><TableHead>Status</TableHead>{canOverride && <TableHead className="text-right">Action</TableHead>}</TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...overrides].sort((a, b) => b.overridden_at.localeCompare(a.overridden_at)).map(o => {
                        const stillFlagged = overridden.some(x => x.override.id === o.id);
                        return (
                          <TableRow key={o.id}>
                            <TableCell><Badge variant="outline" className={SEVERITY_STYLE[o.severity as Severity]}>{o.severity}</Badge></TableCell>
                            <TableCell className="font-medium">{o.title}</TableCell>
                            <TableCell className="max-w-[360px] text-sm text-muted-foreground">{o.reason}</TableCell>
                            <TableCell className="text-sm">{o.overridden_by_email}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{new Date(o.overridden_at).toLocaleString()}</TableCell>
                            <TableCell>
                              {o.revoked_at ? <Badge variant="secondary">Exception cancelled</Badge> : stillFlagged ? <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900">Accepted exception</Badge> : <Badge variant="secondary">Warning no longer found</Badge>}
                            </TableCell>
                            {canOverride && <TableCell className="text-right">{!o.revoked_at && <Button size="sm" variant="ghost" onClick={() => void revoke(o.id)}><Undo2 className="mr-1 h-4 w-4" />Cancel exception</Button>}</TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="elmis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Identity checks (ELMIS)
                {mode && <Badge variant="outline" className={mode === 'live' ? ELMIS_STYLE.verified : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'}>{mode === 'live' ? 'Live' : 'Practice only'}</Badge>}
              </CardTitle>
              <CardDescription>
                {mode ? 'Checks each candidate’s passport and identity against the Ethiopian Labour Market Information System.' : 'ELMIS verification is not configured. Candidate records can still be exported for review.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void verifyAll()} disabled={!mode || bulkRunning || candidates.length === 0}>
                  {bulkRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify all unverified
                </Button>
                <Button variant="outline" onClick={() => downloadFile('elmis-candidates.csv', buildElmisCsv(candidates))}><Download className="mr-2 h-4 w-4" />Export CSV for ELMIS upload</Button>
                <span className="text-sm text-muted-foreground">{verified} of {candidates.length} verified</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Candidate</TableHead><TableHead>Passport</TableHead><TableHead>ELMIS status</TableHead><TableHead>Registration ID</TableHead><TableHead>Checked</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map(c => (
                      <TableRow key={c.id}>
                        <TableCell><div className="flex items-center gap-2 font-medium"><CandidateAvatar candidate={c} className="h-8 w-8" />{c.first_name} {c.last_name}</div></TableCell>
                        <TableCell>{c.passport_number}</TableCell>
                        <TableCell>
                          {c.elmis
                            ? <Badge variant="outline" className={ELMIS_STYLE[c.elmis.status]}>{c.elmis.status.replace('_', ' ')}</Badge>
                            : <span className="text-sm text-muted-foreground">Not checked</span>}
                          {c.elmis?.mismatches?.length ? <p className="text-xs text-muted-foreground">Differs: {c.elmis.mismatches.join(', ')}</p> : null}
                        </TableCell>
                        <TableCell className="text-sm">{c.elmis?.registration_id ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.elmis ? new Date(c.elmis.checked_at).toLocaleString() : '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" disabled={!mode || checking === c.id || bulkRunning} onClick={() => void verifyOne(c)}>
                            {checking === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : c.elmis ? 'Re-check' : 'Verify'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Activity history</CardTitle>
              <CardDescription>Every sensitive action with who did it and when. Latest 200 entries.</CardDescription>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant={auditScope === 'superadmin' ? 'default' : 'outline'} onClick={() => setAuditScope('superadmin')}>Superadmin actions</Button>
                <Button size="sm" variant={auditScope === 'all' ? 'default' : 'outline'} onClick={() => setAuditScope('all')}>Everyone</Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Record changed</TableHead><TableHead>Details</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap text-sm">{new Date(l.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="text-sm">{l.actor_email}</TableCell>
                          <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                          <TableCell className="text-sm">{l.target_type}</TableCell>
                          <TableCell className="max-w-[420px] text-sm text-muted-foreground">{l.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!overrideTarget} onOpenChange={open => { if (!open) setOverrideTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this warning as an exception</DialogTitle>
            <DialogDescription>{overrideTarget?.title}: {overrideTarget?.detail}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">This removes the warning from the score, but does not fix or delete the original record. Your reason, name and time are saved for the auditor to review.</p>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this warning should be accepted as an exception." rows={4} />
            <p className="text-xs text-muted-foreground">{reason.trim().length} / {MIN_OVERRIDE_REASON} characters minimum</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            <Button onClick={() => void submitOverride()} disabled={savingOverride || reason.trim().length < MIN_OVERRIDE_REASON}>
              {savingOverride && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accept exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIntegrity;
