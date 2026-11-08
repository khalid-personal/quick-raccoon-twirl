import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Video } from 'lucide-react';
import CandidateCheckpoint from './CandidateCheckpoint';
import type { Candidate } from '@/lib/types';
import { candidateWorkType } from '@/lib/candidate-staffing';

interface CandidateIntroductionMediaProps {
  candidate: Candidate;
  compact?: boolean;
}

const CandidateIntroductionMedia: React.FC<CandidateIntroductionMediaProps> = ({ candidate, compact = false }) => {
  return <Card className={compact ? undefined : 'overflow-hidden rounded-3xl border-cyan-500/25'}>
    {!compact && <CandidateCheckpoint eyebrow="Meet the candidate" title="Candidate introduction" description="Bring the candidate's experience, skills and languages together with their introduction recording." icon={Video} />}
    <CardContent className={compact ? 'space-y-3 p-0' : 'grid gap-5 p-5 sm:grid-cols-2 sm:p-7'}>
      <div><p className="text-xs font-medium uppercase text-muted-foreground">Work / job type</p><p className="mt-1 text-sm">{candidateWorkType(candidate)}</p></div>
      <div><p className="text-xs font-medium uppercase text-muted-foreground">Professional summary</p><p className="mt-1 text-sm leading-6">{candidate.professional_summary || 'Required — not added yet.'}</p></div>
      <div><p className="text-xs font-medium uppercase text-muted-foreground">Skills</p><p className="mt-1 text-sm">{candidate.skills?.length ? candidate.skills.join(' · ') : 'Required — not added yet.'}</p></div>
      <div><p className="text-xs font-medium uppercase text-muted-foreground">Languages</p><p className="mt-1 text-sm">{candidate.languages?.length ? candidate.languages.join(' · ') : 'Required — not added yet.'}</p></div>
      {candidate.intro_video_url && <div className="space-y-1">
        {candidate.intro_video_url === '/demo-intros/illustrative-introduction.mp4' && <p className="text-xs text-muted-foreground">Illustrative demo clip only; this is not a candidate recording.</p>}
        <video className="max-h-72 w-full rounded border bg-black" controls preload="metadata" src={candidate.intro_video_url}>Video playback is not supported in this browser.</video>
      </div>}
      {!candidate.intro_video_url && <p className="text-sm text-muted-foreground">Introduction video: required — not added yet.</p>}
    </CardContent>
  </Card>;
};

export default CandidateIntroductionMedia;
