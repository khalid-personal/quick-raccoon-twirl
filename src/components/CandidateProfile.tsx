import React from 'react';
import { CandidateDetail } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import { format } from 'date-fns';
import ProgressIndicator from './ProgressIndicator';
import { calculateProgress } from '@/lib/utils-data';
import { Button } from '@/components/ui/button';
import { Pencil, UserRound } from 'lucide-react';
import CandidateAvatar from './CandidateAvatar';
import PassportButton from './PassportButton';
import MinistryQrPanel from './MinistryQrPanel';
import CandidateDeploymentPackage from './CandidateDeploymentPackage';
import { EntityProfileButton } from './CandidateQuickViewProvider';
import CandidateSubmissionDeadline from './CandidateSubmissionDeadline';
import { candidateLaborId } from '@/lib/ministry-candidates';

interface CandidateProfileProps {
  candidate: CandidateDetail;
  onEdit: () => void; // New prop to trigger the edit dialog
  onChanged?: () => void;
}

const CandidateProfile: React.FC<CandidateProfileProps> = ({ candidate, onEdit, onChanged }) => {
  const progress = calculateProgress(candidate.stages);
  return (
    <Card data-tour="candidate-profile" className="overflow-hidden rounded-3xl border-cyan-500/25">
      <CandidateCheckpoint eyebrow="Candidate details" title="Candidate Profile" description="Check personal details, linked agencies and submission dates. Complete this profile before sharing it or preparing the candidate to travel." icon={UserRound} metric={`${progress}%`} metricLabel="Journey progress" actions={
        <Button variant="outline" className="h-12 rounded-xl px-5" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Edit Details
        </Button>
      } />
      <CardContent className="grid grid-cols-1 gap-6 p-5 sm:p-7 md:grid-cols-3">
        {/* Profile Image */}
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border bg-cyan-500/5 p-5 md:col-span-1">
          <CandidateAvatar candidate={candidate} className="h-36 w-36 text-4xl" />
          <p className="text-sm text-muted-foreground">Profile Photo</p>
          <PassportButton candidate={candidate} />
          <CandidateDeploymentPackage candidate={candidate} />
        </div>

        <div className="space-y-4 rounded-2xl border bg-background/70 p-5 md:col-span-1">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Full Name</p>
            <p className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Gender</p>
            <p className="text-lg capitalize">{candidate.gender || 'Not recorded'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Passport Number</p>
            <p className="text-lg">{candidate.passport_number}</p>
          </div>
          {candidate.passport_nationality && <div className="text-sm"><p className="font-medium text-muted-foreground">Passport Nationality</p><p>{candidate.passport_nationality}</p></div>}
          {candidate.passport_issuing_country && <div className="text-sm"><p className="font-medium text-muted-foreground">Passport Issuing Country</p><p>{candidate.passport_issuing_country}</p></div>}
          {candidate.passport_expiry_date && <div className="text-sm"><p className="font-medium text-muted-foreground">Passport Expiry</p><p>{candidate.passport_expiry_date}</p></div>}
          {candidate.passport_document_type && <div className="text-sm"><p className="font-medium text-muted-foreground">Passport Document Type</p><p>{candidate.passport_document_type}</p></div>}
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Phone Number</p>
            <p className="text-lg">{candidate.phone_number || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Date of Birth</p>
            <p className="text-lg">{format(new Date(candidate.dob), 'PPP')}</p>
          </div>
        </div>
        
        <div className="space-y-4 rounded-2xl border bg-background/70 p-5 md:col-span-1">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Tracking Code</p>
            <p className="text-lg font-mono font-semibold">{candidate.tracking_code}</p>
          </div>
          <div className="text-sm"><p className="font-medium text-muted-foreground">Labor ID</p><p className="font-mono font-semibold">{candidateLaborId(candidate, candidate.stages) || 'Awaiting ministry details'}</p></div>
          <div className="text-sm"><p className="font-medium text-muted-foreground">ELMIS registration</p><p>{candidate.elmis?.registration_id || 'Awaiting ministry details'}</p><p className="text-xs text-muted-foreground">{candidate.elmis?.mode === 'live' ? 'Ministry record' : 'Official connection pending; existing practice details are not a live ministry record.'}</p></div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">COC Training Facility</p> {/* Updated Label */}
            <p className="text-lg font-semibold"><EntityProfileButton kind="coc" entityId={candidate.coc_facility_id}>{candidate.coc_facility_name || 'N/A'}</EntityProfileButton></p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Managing Local Agency</p> {/* Updated Label */}
            <p className="text-lg font-semibold"><EntityProfileButton kind="local-agency" entityId={candidate.local_agency_id}>{candidate.local_agency_name || 'N/A'}</EntityProfileButton></p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Foreign Employment Agency</p>
            <p className="text-lg font-semibold"><EntityProfileButton kind="foreign-agency" entityId={candidate.foreign_agency_id}>{candidate.foreign_agency_name || 'N/A'}</EntityProfileButton></p>
          </div>
        </div>
        
        <div className="md:col-span-3"><CandidateSubmissionDeadline /></div>
        <div className="md:col-span-3"><MinistryQrPanel candidate={candidate} onChanged={onChanged} /></div>
        <ProgressIndicator percent={progress} className="md:col-span-3" />
      </CardContent>
    </Card>
  );
};

export default CandidateProfile;