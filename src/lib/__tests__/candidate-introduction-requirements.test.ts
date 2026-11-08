import { describe, expect, it } from 'vitest';
import { NewCandidateSchema } from '@/components/NewCandidateForm/schema';
import { hasCompleteCandidateIntroduction } from '../candidate-introduction';

const completeCandidate = {
  first_name: 'Test',
  last_name: 'Candidate',
  dob: '1995-01-01',
  passport_number: 'P1',
  tracking_code: 'TRK-ET-0001',
  country_of_origin: 'Ethiopia',
  marital_status: 'Single',
  gender: 'female',
  professional_summary: 'Experienced household professional.',
  skills_text: 'Cooking, cleaning',
  languages_text: 'Amharic',
  intro_video_url: 'https://example.test/intro.mp4',
  email: 'candidate@example.test',
  coc_facility_id: 'center-1',
  local_agency_id: 'agency-1',
};

describe('candidate introduction requirements', () => {
  it('accepts a complete gender and introduction profile', () => {
    expect(NewCandidateSchema.safeParse(completeCandidate).success).toBe(true);
  });

  it('requires gender, professional summary, skills, languages, and introduction video', () => {
    for (const field of ['gender', 'professional_summary', 'skills_text', 'languages_text', 'intro_video_url'] as const) {
      expect(NewCandidateSchema.safeParse({ ...completeCandidate, [field]: '' }).success).toBe(false);
    }
  });

  it('only considers a candidate introduction complete when all required profile fields are present', () => {
    const profile = {
      gender: 'female' as const,
      professional_summary: 'Experienced household professional.',
      skills: ['Cooking', 'Cleaning'],
      languages: ['Amharic'],
      intro_video_url: 'https://example.test/intro.mp4',
    };

    expect(hasCompleteCandidateIntroduction(profile)).toBe(true);
    expect(hasCompleteCandidateIntroduction({ ...profile, skills: [] })).toBe(false);
    expect(hasCompleteCandidateIntroduction({ ...profile, gender: undefined })).toBe(false);
  });
});
