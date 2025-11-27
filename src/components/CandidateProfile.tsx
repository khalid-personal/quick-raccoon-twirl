import React from 'react';
import { CandidateDetail } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import ProgressIndicator from './ProgressIndicator';
import { calculateProgress } from '@/lib/api'; // Use the utility from api.ts

interface CandidateProfileProps {
  candidate: CandidateDetail;
}

const CandidateProfile: React.FC<CandidateProfileProps> = ({ candidate }) => {
  const progress = calculateProgress(candidate.stages);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Profile</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Full Name</p>
            <p className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Passport Number</p>
            <p className="text-lg">{candidate.passport_number || 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Country of Origin</p>
            <p className="text-lg">{candidate.country_of_origin || 'N/A'}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Date of Birth</p>
            <p className="text-lg">{candidate.dob ? format(new Date(candidate.dob), 'PPP') : 'N/A'}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Minor Status</p>
            <p className={`text-lg font-semibold ${candidate.is_minor ? 'text-red-500' : 'text-green-500'}`}>
              {candidate.is_minor ? 'YES (Requires Guardian Signature)' : 'No'}
            </p>
          </div>
          {candidate.is_minor && (
            <>
              <div className="text-sm">
                <p className="font-medium text-muted-foreground">Guardian Name</p>
                <p className="text-lg">{candidate.guardian_name || 'N/A'}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-muted-foreground">Guardian Contact</p>
                <p className="text-lg">{candidate.guardian_contact || 'N/A'}</p>
              </div>
            </>
          )}
        </div>
        
        <ProgressIndicator percent={progress} className="md:col-span-1" />
      </CardContent>
    </Card>
  );
};

export default CandidateProfile;