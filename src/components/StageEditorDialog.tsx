import type { CandidateDetail, CandidateStage, Stage } from '@/lib/types';
import { ShieldCheck, MapPin, Clock3 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import StageDocumentUploader from './StageDocumentUploader';
import MedicalResultsEditor from './MedicalResultsEditor';

interface Props {
  candidateDetail: CandidateDetail;
  candidateStage: CandidateStage;
  stage: Stage;
  refetch: () => void;
  onClose: () => void;
}

export default function StageEditorDialog({ candidateDetail, candidateStage, stage, refetch, onClose }: Props) {
  return <DialogContent className="sm:max-w-[850px]">
    <DialogHeader><DialogTitle>{stage.title} · {candidateDetail.tracking_code}</DialogTitle>
      <DialogDescription>Ministry-owned stage record. Supporting uploads remain available without changing progression.</DialogDescription>
    </DialogHeader>
    <section className="ministry-stage-summary" aria-label="Ministry stage record">
      <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><ShieldCheck />Ministry status</span><Badge variant="outline">{candidateStage.status}</Badge></div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt>Reference number</dt><dd>{candidateStage.reference_id || 'Awaiting ministry reference'}</dd></div>
        <div><dt className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Recorded date</dt><dd>{candidateStage.date ? new Date(candidateStage.date).toLocaleDateString() : 'Awaiting ministry update'}</dd></div>
        <div><dt className="flex items-center gap-2"><MapPin className="h-4 w-4" />Stage location</dt><dd>{candidateStage.location ? `${candidateStage.location.name} · ${candidateStage.location.city}` : 'Awaiting ministry location'}</dd></div>
      </dl>
      {candidateStage.notes && <p className="text-muted-foreground">{candidateStage.notes}</p>}
    </section>
    {stage.slug === 'medical' && <MedicalResultsEditor candidateDetail={candidateDetail} refetch={refetch} />}
    <section className="space-y-3"><h3>Supporting documents</h3><StageDocumentUploader candidateId={candidateDetail.id} stageId={stage.id} existingDocuments={candidateDetail.documents.filter(doc => doc.stage_id === stage.id)} refetch={refetch} /></section>
    <DialogFooter><Button variant="outline" onClick={onClose}>Close record</Button></DialogFooter>
  </DialogContent>;
}
