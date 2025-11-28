import React from 'react';
import { CandidateDetail, ALL_STAGES } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import ProgressIndicator from './ProgressIndicator';
import { calculateProgress } from '@/lib/utils-data';
import { Badge } from '@/components/ui/badge';
import { getStatusColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface CandidateProfileProps {
  candidate: CandidateDetail;
  onEdit: () => void; // New prop to trigger the edit dialog
}

const CandidateProfile: React.FC<CandidateProfileProps> = ({ candidate, onEdit }) => {
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
        <CardTitle>Candidate Profile</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Edit Details
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Full Name</p>
            <p className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Passport Number</p>
            <p className="text-lg">{candidate.passport_number}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Phone Number</p>
            <p className="text-lg">{candidate.phone_number || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Date of Birth</p>
            <p className="text-lg">{format(new Date(candidate.dob), 'PPP')}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Tracking Code</p>
            <p className="text-lg font-mono font-semibold">{candidate.tracking_code}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">COC Training Agency</p>
            <p className="text-lg font-semibold">{candidate.coc_agency || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Foreign Employment Agency</p>
            <p className="text-lg font-semibold">{candidate.foreign_agency || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Labor ID Registration Status</p>
            <Badge className={getStatusColor(laborIdStatus)}>
              {laborIdStatus.toUpperCase()}
            </Badge>
            {laborIdNumber && (
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                ID: {laborIdNumber}
              </p>
            )}
            {laborIdDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Date: {format(new Date(laborIdDate), 'PPP')}
              </p>
            )}
          </div>
        </div>
        
        <ProgressIndicator percent={progress} className="md:col-span-1" />
      </CardContent>
    </Card>
  );
};

export default CandidateProfile;