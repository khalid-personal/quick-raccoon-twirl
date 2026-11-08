import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Phone } from 'lucide-react';
import CandidateCheckpoint from './CandidateCheckpoint';
import type { CandidateDetail } from '@/lib/types';

interface CandidateContactsProps {
  candidate: CandidateDetail;
  onChanged: () => void;
}

const CandidateContacts: React.FC<CandidateContactsProps> = ({ candidate }) => <Card className="overflow-hidden rounded-3xl border-cyan-500/25">
  <CandidateCheckpoint eyebrow="Candidate support checkpoint" title="Contact and emergency details" description="Keep candidate, emergency and employer contacts within reach when follow-up is needed." icon={Phone} />
  <CardContent className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
    <div><p className="text-xs font-medium uppercase text-muted-foreground">Candidate</p><p className="mt-1">{candidate.phone_number ? <a href={`tel:${candidate.phone_number}`} className="underline underline-offset-2">{candidate.phone_number}</a> : 'No phone number'}</p><p className="text-sm">{candidate.email || 'No email address'}</p></div>
    <div><p className="text-xs font-medium uppercase text-muted-foreground">Emergency contact</p><p className="mt-1">{candidate.emergency_contact?.name || 'Not provided'}</p><p className="text-sm text-muted-foreground">{candidate.emergency_contact?.relationship || ''}</p>{candidate.emergency_contact?.phone && <a href={`tel:${candidate.emergency_contact.phone}`} className="text-sm underline underline-offset-2">{candidate.emergency_contact.phone}</a>}</div>
    <div><p className="text-xs font-medium uppercase text-muted-foreground">Employer</p><p className="mt-1">{candidate.employer?.company || 'Not assigned'}</p><p className="text-sm text-muted-foreground">{candidate.employer?.contact_name || ''}</p>{candidate.employer?.phone && <a href={`tel:${candidate.employer.phone}`} className="text-sm underline underline-offset-2">{candidate.employer.phone}</a>}</div>
  </CardContent>
</Card>;

export default CandidateContacts;
