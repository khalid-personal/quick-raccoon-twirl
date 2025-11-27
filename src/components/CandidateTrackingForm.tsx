import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User } from 'lucide-react';
import { api } from '@/lib/api';

const CandidateTrackingForm: React.FC = () => {
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    const passport = passportNumber.trim().toUpperCase();

    if (!code && !passport) {
        toast.error("Please enter either a Tracking Code or a Passport Number.");
        return;
    }
    
    setIsLoggingIn(true);
    
    try {
        // We pass both, and the API will check if either matches a candidate record.
        const candidateData = await api.verifyCandidateCredentials(code, passport);
        
        if (candidateData) {
            toast.success(`Access granted! Redirecting to tracking page.`);
            navigate(`/track/${candidateData.tracking_code}`, { replace: true });
        } else {
            toast.error("Verification failed. Check your Tracking Code or Passport Number.");
        }
    } catch (error) {
        toast.error((error as Error).message || "An unexpected error occurred during verification.");
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <CardContent className="space-y-6 p-0">
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="trackingCode">Tracking Code (Optional)</Label>
          <Input 
            id="trackingCode" 
            type="text" 
            placeholder="e.g., TRK-ET-0001"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            disabled={isLoggingIn}
          />
        </div>
        <div className="text-center text-sm text-muted-foreground">- OR -</div>
        <div className="space-y-2">
          <Label htmlFor="passportNumber">Passport Number (Optional)</Label>
          <Input 
            id="passportNumber" 
            type="text" 
            placeholder="Enter your Passport Number"
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
            disabled={isLoggingIn}
          />
        </div>
        <Button type="submit" className="w-full text-lg" disabled={isLoggingIn || (!trackingCode.trim() && !passportNumber.trim())}>
          {isLoggingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <User className="h-5 w-5 mr-2" />} 
          Access Status
        </Button>
      </form>
    </CardContent>
  );
};

export default CandidateTrackingForm;