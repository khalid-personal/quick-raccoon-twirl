import React from 'react';
import { CandidateDetail, ALL_STAGES } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import ProgressIndicator from './ProgressIndicator';
import { calculateProgress } from '@/lib/utils-data';
import { Badge } from '@/components/ui/badge';
import { getStatusColor } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

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
    <Card className="shadow-none border-0">
      <CardHeader className="flex flex-row items-center justify-between p-0 mb-4">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={candidate.profile_image_url || '/placeholder.svg'} alt={`${candidate.first_name} ${candidate.last_name}`} />
            <AvatarFallback>
              <User className="h-10 w-10 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
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
            <p className="font-medium text-muted-foreground">COC Training Agency</p>
            <p className="text-lg font-semibold">{candidate.coc_agency || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Foreign Employment Agency</p>
            <p className="text-lg font-semibold">{candidate.foreign_agency || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Batch Group</p>
            <p className="text-lg font-semibold">{candidate.batch_name || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Labor ID Status</p>
            <Badge className={getStatusColor(laborIdStatus)}>
              {laborIdStatus.toUpperCase()}
            </Badge>
            {laborIdNumber && (
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                ID: {laborIdNumber}
              </p>
            )}
          </div>
        </div>
        
        <div className="md:col-span-full lg:col-span-3">
          <ProgressIndicator percent={progress} className="w-full" />
        </div>
      </CardContent>
    </Card>
  );
};

export default CandidateProfilePreview;