import type { Candidate } from './types';

type CandidateIntroduction = Pick<Candidate, 'gender' | 'professional_summary' | 'skills' | 'languages' | 'intro_video_url'>;

export const hasCompleteCandidateIntroduction = (candidate: CandidateIntroduction): boolean =>
  (candidate.gender === 'male' || candidate.gender === 'female')
  && !!candidate.professional_summary?.trim()
  && !!candidate.skills?.some(skill => skill.trim())
  && !!candidate.languages?.some(language => language.trim())
  && !!candidate.intro_video_url?.trim();
