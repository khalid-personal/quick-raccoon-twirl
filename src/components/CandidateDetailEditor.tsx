import { LockKeyhole, Database, GraduationCap, UserRound } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { DialogFooter } from './ui/dialog';
import { useId } from 'react';
import type { CandidateDetail } from '@/lib/types';
import { candidateLaborId, MINISTRY_PROFILE_MESSAGE } from '@/lib/ministry-candidates';
import { practiceRecordLabel } from '@/lib/practice-record-label';

interface CandidateDetailEditorProps {
  candidate: CandidateDetail;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CandidateDetailEditor({ candidate, onClose }: CandidateDetailEditorProps) {
  const prefix = useId();
  const practice = candidate.id.startsWith('demo-') || candidate.elmis?.mode === 'sandbox';
  const sections = [
    { title: 'Identity & ministry references', icon: UserRound, fields: [
      ['First name', candidate.first_name], ['Last name', candidate.last_name],
      ['Gender', candidate.gender], ['Date of birth', candidate.dob],
      ['Passport number', candidate.passport_number], ['Tracking code · DAWM reference', candidate.tracking_code],
      ['Passport nationality', candidate.passport_nationality], ['Passport issuing country', candidate.passport_issuing_country],
      ['Passport expiry', candidate.passport_expiry_date], ['Passport document type', candidate.passport_document_type],
      ['Labor ID', candidateLaborId(candidate, candidate.stages)],
      ['ELMIS registration', practiceRecordLabel(candidate.elmis?.registration_id, practice)],
      ['Country of origin', candidate.country_of_origin], ['Marital status', candidate.marital_status],
      ['Home city', candidate.home_city], ['Home region', candidate.home_region],
    ] },
    { title: 'Contact & candidate introduction', icon: Database, fields: [
      ['Email / login identifier', candidate.email], ['Phone number', candidate.phone_number],
      ['Emergency contact', candidate.emergency_contact?.name], ['Emergency phone', candidate.emergency_contact?.phone],
      ['Occupation', candidate.occupation], ['Professional summary', candidate.professional_summary],
      ['Skills', candidate.skills?.join(', ')], ['Languages', candidate.languages?.join(', ')],
      ['Introduction video', candidate.intro_video_url],
    ] },
    { title: 'CoC & linked organizations', icon: GraduationCap, fields: [
      ['CoC training center', candidate.coc_facility_name],
      ['Managing local agency', candidate.local_agency_name],
      ['Foreign employment agency', candidate.foreign_agency_name],
      ['Batch group · DAWM organization', candidate.batch_name],
    ] },
  ];
  return <div className="ministry-record-console space-y-5">
    <div className="ministry-record-banner rounded-2xl p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"><LockKeyhole className="h-4 w-4" />Ministry-managed record</p>
      <h3 className="mt-2 text-xl font-semibold">Review here. Correct at the source.</h3>
      <p className="mt-2 text-sm">{MINISTRY_PROFILE_MESSAGE}</p>
      <p className="mt-2 text-xs">{practice ? 'Fictional practice record · not a live ministry response.' : 'Recorded source details · no external ministry sync is claimed.'} DAWM tracking and operational groups remain separate from official ministry identifiers.</p>
    </div>
    {sections.map(({ title, icon: Icon, fields }, sectionIndex) => <section key={title} className="rounded-2xl border bg-card p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-primary" />{title}<LockKeyhole aria-hidden="true" className="ml-auto h-4 w-4 text-muted-foreground" /></h3>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([label, value], index) => {
        const id = `${prefix}-${sectionIndex}-${index}`;
        return <div key={label} className="min-w-0 space-y-2">
          <Label htmlFor={id}>{label}</Label>
          {label === 'Professional summary' || label === 'Skills'
            ? <Textarea id={id} value={value || 'Not recorded · awaiting source details'} readOnly aria-disabled="true" rows={3} className="ministry-owned-field" />
            : <Input id={id} value={value || 'Not recorded · awaiting source details'} readOnly aria-disabled="true" className="ministry-owned-field" />}
        </div>;
      })}</div>
    </section>)}
    <p className="text-sm text-muted-foreground">CoC assessments and certificates are candidate-linked in the ministry portal. DAWM cannot reassign a center here. Payment receipts, evidence uploads and authorized follow-ups remain separate portal actions.</p>
    <DialogFooter><Button variant="outline" onClick={onClose}>Back to candidate</Button></DialogFooter>
  </div>;
}
