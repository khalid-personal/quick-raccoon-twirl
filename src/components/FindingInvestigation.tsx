import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import type { Finding } from '@/lib/integrity';
import { ALL_STAGES } from '@/lib/types';
import { getCandidates, getCandidateStages, getStaffUsers } from '@/lib/data-store';
import { assignCandidateStageTask } from '@/lib/api/staff-work';
import { useAuth } from '@/lib/auth-context';
import { useCandidateWorkspace } from './CandidateQuickViewProvider';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export default function FindingInvestigation({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}><FileSearch />Investigate</Button>{open && <FindingInvestigationPanel finding={finding} onClose={() => setOpen(false)} />}</>;
}
function FindingInvestigationPanel({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  const workspace = useCandidateWorkspace();
  const payment = !!finding.paymentId || finding.rule.includes('payment');
  const candidate = getCandidates().find(candidate => candidate.id === finding.candidateId);
  const stages = getCandidateStages();
  const stage = ALL_STAGES.map(meta => stages.find(stage => stage.candidate_id === candidate?.id && stage.stage_id === meta.id)).find(stage => stage && !['Passed', 'Issued', 'Completed'].includes(stage.status));
  const section = payment ? 'payments' : finding.rule.includes('visa') ? 'contract' : finding.rule.includes('medical') ? 'medical' : finding.rule.includes('stage') || finding.rule.includes('training') ? 'timeline' : 'profile';
  const staff = getStaffUsers().filter(user => user.role === 'staff' && user.is_approved && (!user.local_agency_id || user.local_agency_id === candidate?.local_agency_id));
  const followUp = async () => {
    if (!candidate || !stage) return;
    setBusy(true);
    try {
      await assignCandidateStageTask(candidate.id, stage.stage_id, owner, { id: auth.viewAs?.userId ?? auth.user?.id ?? '', email: auth.user?.email ?? '', role: auth.userRole ?? '' });
      toast.success('Follow-up assigned with an audit record and stage deadline. Existing deadlines were preserved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not assign follow-up.'); }
    finally { setBusy(false); }
  };
  return <>
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{finding.title}</DialogTitle><DialogDescription>A helping hand: find the cause, correct verified facts, then follow up or escalate. A flag is not a verdict.</DialogDescription></DialogHeader>
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">{finding.detail}</p>
      <ol className="space-y-3">{[
        payment ? 'Compare the receipt, receiving agency, contract allocation and exact bank reference. Keep currency mismatches separate from amount gaps.' : `Open ${section === 'profile' ? 'the candidate profile' : section} and verify the source record causing this warning.`,
        'Ask the candidate or responsible staff/agency for missing information. Correct only supported details—do not invent dates, payments or documents.',
        payment ? 'Underpayment or overpayment belongs in Resolve & protect. Escalate with evidence; only the superadmin can suspend, review an appeal or reinstate an agency.' : 'Use the first unfinished stage for a timed follow-up. High-risk or repeated unresolved findings should be raised to the superadmin; overrides require a documented reason.',
      ].map((step, index) => <li key={step} className="flex gap-3 rounded-xl border bg-primary/5 p-4"><span className="font-bold text-primary">{index + 1}.</span><p className="text-sm">{step}</p></li>)}</ol>
      <div className="flex flex-wrap gap-2">{candidate && workspace && <Button onClick={() => { onClose(); workspace(candidate.id, { tab: section, stageId: section === 'timeline' ? stage?.stage_id : undefined }); }}>Open the right candidate section<ClipboardCheck /></Button>}{payment && <Button asChild variant="outline"><Link to="/admin/payments#resolution" onClick={onClose}>Review payment escalation</Link></Button>}</div>
      {auth.userRole === 'superadmin' && candidate && stage && <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Assign a candidate follow-up</h4><p className="text-sm text-muted-foreground">This goes to the first unfinished stage. Its existing due date is kept; otherwise a one-day deadline is added.</p><Select value={owner} onValueChange={setOwner}><SelectTrigger aria-label="Follow-up staff"><SelectValue placeholder="Choose approved staff" /></SelectTrigger><SelectContent>{staff.map(user => <SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !owner} onClick={() => void followUp()}>Assign follow-up · audit logged</Button></section>}
      <p className="text-xs text-muted-foreground">Correcting the source record removes a rule flag on refresh. An override is an exception, not proof that the issue was fixed.</p>
    </DialogContent></Dialog>
  </>;
}
