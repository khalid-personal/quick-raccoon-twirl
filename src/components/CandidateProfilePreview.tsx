import React from 'react';
import { CandidateDetail } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { format } from 'date-fns';
import ProgressIndicator from './ProgressIndicator';
import { calculateProgress } from '@/lib/utils-data';
import CandidateAvatar from './CandidateAvatar';
import CandidateIntroductionMedia from './CandidateIntroductionMedia';

interface CandidateProfilePreviewProps {
  candidate: CandidateDetail;
}

const CandidateProfilePreview: React.FC<CandidateProfilePreviewProps> = ({ candidate }) => {
  const progress = calculateProgress(candidate.stages);
  
  return (
    <Card className="shadow-none border-0">
      <CardHeader className="flex flex-row items-center justify-between p-0 mb-4">
        <div className="flex items-center space-x-4">
          <CandidateAvatar candidate={candidate} className="h-20 w-20 text-xl" />
          <div>
            <CardTitle className="text-3xl font-bold">
              {candidate.first_name} {candidate.last_name} 
            </CardTitle>
            <p className="text-lg font-normal text-muted-foreground">Tracking Code: <span className="font-mono font-semibold">{candidate.tracking_code}</span></p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-0">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Gender</p>
            <p className="text-lg capitalize">{candidate.gender || 'Not recorded'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Passport Number</p>
            <p className="text-lg">{candidate.passport_number}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Date of Birth</p>
            <p className="text-lg">{format(new Date(candidate.dob), 'PPP')}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Country of Origin</p>
            <p className="text-lg">{candidate.country_of_origin}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Marital Status</p>
            <p className="text-lg">{candidate.marital_status}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Phone Number</p>
            <p className="text-lg">{candidate.phone_number || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Email (Login)</p>
            <p className="text-lg">{candidate.email}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">COC Training Facility</p> {/* Updated Label */}
            <p className="text-lg font-semibold">{candidate.coc_facility_name || 'N/A'}</p> {/* Display name */}
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Managing Local Agency</p> {/* Updated Label */}
            <p className="text-lg font-semibold">{candidate.local_agency_name || 'N/A'}</p> {/* Display name */}
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Foreign Employment Agency</p>
            <p className="text-lg font-semibold">{candidate.foreign_agency_name || 'N/A'}</p> {/* Display name */}
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Batch Group</p>
            <p className="text-lg font-semibold">{candidate.batch_name || 'N/A'}</p>
          </div>
        </div>
        
        <div className="md:col-span-full lg:col-span-3">
          <CandidateIntroductionMedia candidate={candidate} compact />
          <ProgressIndicator percent={progress} className="w-full" />
        </div>
      </CardContent>
    </Card>
  );
};

export default CandidateProfilePreview;