import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { NewCandidateFormValues } from './schema';

interface CandidateIntroductionSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
}

const CandidateIntroductionSection: React.FC<CandidateIntroductionSectionProps> = ({ form }) => {
  const { register, formState: { errors } } = form;

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Candidate Introduction (Required)</h3>
      <p className="text-sm text-muted-foreground">Complete the candidate-authored profile information and add the secure link to their introduction video before creating the record.</p>
      <div className="space-y-2">
        <Label htmlFor="occupation">Work / job type</Label>
        <Input id="occupation" {...register('occupation')} placeholder="Housemaid, Cook, Nanny, Driver" />
        <p className="text-xs text-muted-foreground">Recorded job types let foreign agencies filter their worker selection board. Add only the candidate's actual work type.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="professional_summary">Professional summary *</Label>
        <Textarea id="professional_summary" {...register('professional_summary')} rows={3} />
        {errors.professional_summary && <p className="text-xs text-red-500">{errors.professional_summary.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="skills_text">Skills (comma separated) *</Label>
        <Textarea id="skills_text" {...register('skills_text')} rows={2} placeholder="Meal preparation, kitchen hygiene" />
        {errors.skills_text && <p className="text-xs text-red-500">{errors.skills_text.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="languages_text">Languages (comma separated) *</Label>
        <Input id="languages_text" {...register('languages_text')} placeholder="Amharic, English" />
        {errors.languages_text && <p className="text-xs text-red-500">{errors.languages_text.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="intro_video_url">Introduction video link *</Label>
        <Input id="intro_video_url" type="url" {...register('intro_video_url')} placeholder="https://…" />
        {errors.intro_video_url && <p className="text-xs text-red-500">{errors.intro_video_url.message}</p>}
      </div>
    </section>
  );
};

export default CandidateIntroductionSection;
