import React from 'react';
import { CandidateDetail, ALL_STAGES } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import ProgressIndicator from './ProgressIndicator';
import { calculateProgress } from '@/lib/utils-data';
import { Badge } from '@/components/ui/badge';

interface CandidateProfilePreviewProps {
  candidate: CandidateDetail;
}

const CandidateProfilePreview: React.FC<CandidateProfilePreviewProps> = ({ candidate }) => {
  const progress = calculateProgress(candidate.stages);
  
  const laborIdStage = candidate.stages.find(cs => 
    ALL_STAGES.find(s => s.id === cs.stage_id)?.slug === 'labor_id'
  );
  
  const laborIdStatus = laborIdStage?.status || 'Pending';
  const laborIdDate = laborIdStage?.date;
  const laborIdNumber = laborIdStage?.reference_id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold">Candidate Profile Preview</CardTitle>
        <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          PREVIEW
        </Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Full Name</p>
            <p className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Passport Number</p>
            <p className="text-lg">{candidate.passport_number}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Date of Birth</p>
            <p className="text-lg">{candidate.dob ? format(new Date(candidate.dob), 'PPP') : 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Phone Number</p>
            <p className="text-lg">{candidate.phone_number || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Email</p>
            <p className="text-lg">{candidate.email || 'N/A'}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Tracking Code</p>
            <p className="text-lg font-mono font-semibold">{candidate.tracking_code}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Country of Origin</p>
            <p className="text-lg">{candidate.country_of_origin}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Marital Status</p>
            <p className="text-lg">{candidate.marital_status}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">COC Training Agency</p>
            <p className="text-lg font-semibold">{candidate.coc_agency || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Foreign Employment Agency</p>
            <p className="text-lg font-semibold">{candidate.foreign_agency || 'N/A'}</p>
          </div>
        </div>
        
        <div className="md:col-span-2">
            <h4 className="text-md font-semibold mb-2">Initial Progress</h4>
            <ProgressIndicator percent={progress} className="w-full" />
            <p className="text-xs text-muted-foreground mt-2">
                This shows the initial progress based on default 'Pending' stages.
            </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CandidateProfilePreview;