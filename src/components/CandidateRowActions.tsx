import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, TriangleAlert, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PassportButton from './PassportButton';
import type { Candidate } from '@/lib/types';
import type { CandidateGuidance } from '@/lib/candidate-guidance';
import { useCandidateWorkspace } from './CandidateQuickViewProvider';

interface Props { candidate: Candidate; profilePath: string; guidance?: CandidateGuidance; }

export default function CandidateRowActions({ candidate, profilePath, guidance }: Props) {
  const openCandidate = useCandidateWorkspace();
  const findings = guidance?.findings ?? [];
  const task = guidance?.task;
  const severe = findings.some(finding => finding.severity === 'critical' || finding.severity === 'high');
  const pending = findings.length > 0 || task?.overdue || guidance?.paymentReview !== 'settled';
  const tone = pending ? 'text-amber-600' : 'text-emerald-600';
  return <div className="flex items-center gap-1">
    {openCandidate ? <Button variant="ghost" size="icon" className="h-8 w-8" title="Open candidate workspace" aria-label={`Open profile for ${candidate.first_name} ${candidate.last_name}`} onClick={() => openCandidate(candidate.id)}><UserRound className="h-4 w-4" /></Button> : <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Open candidate profile" aria-label={`Open profile for ${candidate.first_name} ${candidate.last_name}`}><Link to={profilePath}><UserRound className="h-4 w-4" /></Link></Button>}
    <PassportButton candidate={candidate} />
    <Popover>
      <PopoverTrigger asChild><Button variant="ghost" size="sm" className={`h-8 gap-1 px-2 transition-transform motion-safe:hover:scale-105 motion-reduce:transition-none ${tone}`} aria-label={`Candidate integrity: ${findings.length} flags${task?.overdue ? ', stage follow-up overdue' : ''}`}><TriangleAlert className="h-4 w-4" /><span className="tabular-nums">{findings.length}</span><span className="text-xs">{pending ? 'Pending review' : 'Settled / clear'}</span></Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div><h3 className="font-semibold">Candidate integrity</h3><p className="text-xs text-muted-foreground">{findings.length} candidate flags · risk points {guidance?.score ?? 0}. Bank-statement cases are reviewed separately.</p></div>
        <p className="text-xs text-muted-foreground">{guidance?.paymentReview === 'settled' ? 'Reached stage fees are covered and their settled receipts match the bank statement.' : 'Stage fee or bank evidence needs review; missing details remain pending until supplied.'} Review flags do not change the candidate’s journey status.{severe ? ' High-severity candidate findings need attention.' : ''}</p>
        {task?.overdue && <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3"><p className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />{task.stageTitle} follow-up overdue</p><p className="mt-1 text-xs">Due {new Date(task.dueAt).toLocaleDateString()}. {task.action}.</p></div>}
        <ul className="max-h-48 space-y-2 overflow-y-auto">{findings.map(finding => <li key={finding.id} className="rounded-lg bg-muted/40 p-2 text-xs"><p className="font-semibold capitalize">{finding.severity} · {finding.title}</p><p className="mt-1 text-muted-foreground">{finding.detail}</p></li>)}</ul>
        {!findings.length && <p className="text-sm text-muted-foreground">No active candidate integrity flags.</p>}
        {task && (openCandidate ? <Button size="sm" className="w-full" onClick={() => openCandidate(candidate.id, { tab: 'timeline', stageId: task.stage.stage_id })}>{task.action}: {task.stageTitle}<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button asChild size="sm" className="w-full"><Link to={`${profilePath}?tab=timeline&stage=${task.stage.stage_id}`}>{task.action}: {task.stageTitle}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>)}
      </PopoverContent>
    </Popover>
  </div>;
}
