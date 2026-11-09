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
import { Textarea } from './ui/textarea';
import { decideIntegrityInvestigation, investigationEscalated } from '@/lib/integrity-investigations';
import { MIN_OVERRIDE_REASON } from '@/lib/integrity-overrides';
import { useQueryClient } from '@tanstack/react-query';
import { practiceRecordLabel } from '@/lib/practice-record-label';
import { isDemoMode } from '@/lib/demo-mode';

export default function FindingInvestigation({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}><FileSearch />Review issue</Button>{open && <FindingInvestigationPanel finding={finding} onClose={() => setOpen(false)} />}</>;
}
function FindingInvestigationPanel({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const auth = useAuth();
  const queryClient = useQueryClient();
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
      toast.success('Follow-up assigned and saved in the activity history. Existing due dates were kept.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not assign follow-up.'); }
    finally { setBusy(false); }
  };
  const decide = async (action: 'escalate' | 'close') => {
    setBusy(true);
    try {
      await decideIntegrityInvestigation(finding, action, reason);
      await queryClient.invalidateQueries({ queryKey: ['portal-work-queue'] });
      toast.success(action === 'close' ? 'Review closed with a recorded exception. Underlying records and agency holds are unchanged.' : 'Escalated for ministry review. No outside message was sent.');
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not record investigation decision.'); }
    finally { setBusy(false); }
  };
  return <>
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{finding.title}</DialogTitle><DialogDescription>Check what caused the warning, correct details supported by proof, then follow up or send the issue for review. A warning does not prove wrongdoing.</DialogDescription></DialogHeader>
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">{practiceRecordLabel(finding.detail, isDemoMode())}</p>
      <ol className="space-y-3">{[
        payment ? 'Compare the receipt, receiving agency, amount owed under the contract and bank transfer reference. Check currency differences separately from missing or extra money.' : `Open ${section === 'profile' ? 'the candidate profile' : section} and check the record causing this warning.`,
        'Ask the candidate or responsible staff/agency for missing information. Correct only supported details—do not invent dates, payments or documents.',
        payment ? 'Open Payment issues for missing or extra money. Send the supporting records for review. Only a superadmin can suspend an agency, review its appeal or restore its access.' : 'Set a follow-up for the first unfinished stage. Send serious or repeated issues to the superadmin. Accepting an exception requires a saved reason.',
      ].map((step, index) => <li key={step} className="flex gap-3 rounded-xl border bg-primary/5 p-4"><span className="font-bold text-primary">{index + 1}.</span><p className="text-sm">{step}</p></li>)}</ol>
      <div className="flex flex-wrap gap-2">{candidate && workspace && <Button onClick={() => { onClose(); workspace(candidate.id, { tab: section, stageId: section === 'timeline' ? stage?.stage_id : undefined }); }}>Open the candidate’s details<ClipboardCheck /></Button>}{payment && <Button asChild variant="outline"><Link to="/admin/payments#resolution" onClick={onClose}>Open Payment issues</Link></Button>}</div>
      {auth.userRole === 'local-agency' && candidate && stage && <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Assign a candidate follow-up</h4><p className="text-sm text-muted-foreground">This goes to the first unfinished stage. Its existing due date is kept; otherwise a one-day deadline is added.</p><Select value={owner} onValueChange={setOwner}><SelectTrigger aria-label="Follow-up staff"><SelectValue placeholder="Choose approved staff" /></SelectTrigger><SelectContent>{staff.map(user => <SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !owner} onClick={() => void followUp()}>Assign follow-up · audit logged</Button></section>}
      {auth.userRole === 'superadmin' && <section aria-label="Investigation decision" className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">{investigationEscalated(finding.id) ? 'Escalated investigation' : 'Record your investigation decision'}</h4><p className="text-sm text-muted-foreground">Escalation keeps the flag open for ministry review. Close accepts a documented exception, retains auditor history and does not correct the source record or lift an agency pause. Agency appeals are decided in Payment issues.</p><Textarea aria-label="Investigation evidence and reason" placeholder="Describe the evidence checked and why you are escalating or closing this review." value={reason} onChange={event => setReason(event.target.value)} /><div className="flex flex-wrap gap-2"><Button disabled={busy || reason.trim().length < MIN_OVERRIDE_REASON} onClick={() => void decide('escalate')}>Escalate investigation</Button><Button variant="outline" disabled={busy || reason.trim().length < MIN_OVERRIDE_REASON} onClick={() => void decide('close')}>Close review with reason</Button></div></section>}
      <p className="text-xs text-muted-foreground">When the record is corrected, its warning disappears after the checks run again. Accepting an exception does not prove the issue was fixed.</p>
    </DialogContent></Dialog>
  </>;
}
