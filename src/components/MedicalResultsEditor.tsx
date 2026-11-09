import { HeartPulse, MapPin, ShieldCheck } from 'lucide-react';
import type { CandidateDetail } from '@/lib/types';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { requiredMedicalExams } from '@/lib/stage-readiness';

export default function MedicalResultsEditor({ candidateDetail }: { candidateDetail: CandidateDetail; refetch: () => void }) {
  return <Card aria-label="Ministry medical results">
    <CardHeader><h3 className="flex items-center gap-2"><HeartPulse className="text-primary" />Medical results</h3><p className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4" />Pulled from the ministry</p></CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2">
      {requiredMedicalExams(candidateDetail.gender).map(exam => {
        const record = candidateDetail.medical_results.find(item => item.exam_type === exam);
        return <article key={exam} className="ministry-result-card">
          <div className="flex flex-wrap items-center justify-between gap-2"><h4>{exam}</h4><Badge variant="outline">{record?.status || 'Awaiting result'}</Badge></div>
          <p>{record?.exam_date ? new Date(record.exam_date).toLocaleDateString() : 'Awaiting ministry date'}</p>
          <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{record?.location ? `${record.location.name} · ${record.location.city}` : 'Awaiting ministry location'}</p>
        </article>;
      })}
    </CardContent>
  </Card>;
}
