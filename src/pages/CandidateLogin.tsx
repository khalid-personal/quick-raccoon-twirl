import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { MadeWithDyad } from '@/components/made-with-dyad';

const CandidateLogin: React.FC = () => {
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    const passport = passportNumber.trim().toUpperCase();

    if (!code || !passport) {
        toast.error("Please enter both Tracking Code and Passport Number.");
        return;
    }
    
    setIsLoggingIn(true);
    
    try {
        // Mock API call to verify credentials before redirecting
        // In a real app, this would check against the database.
        const candidateData = await api.verifyCandidateCredentials(code, passport);
        
        if (candidateData) {
            toast.success(`Welcome, ${candidateData.first_name}! Redirecting to tracking page.`);
            navigate(`/track/${code}`, { replace: true });
        } else {
            toast.error("Verification failed. Check your Tracking Code and Passport Number.");
        }
    } catch (error) {
        toast.error((error as Error).message || "An unexpected error occurred during verification.");
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Candidate Portal Access</CardTitle>
          <CardDescription>Enter your credentials to view your application status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trackingCode">Tracking Code</Label>
              <Input 
                id="trackingCode" 
                type="text" 
                placeholder="e.g., TRK-ET-0001"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                required
                disabled={isLoggingIn}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passportNumber">Passport Number</Label>
              <Input 
                id="passportNumber" 
                type="text" 
                placeholder="Enter your Passport Number"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                required
                disabled={isLoggingIn}
              />
            </div>
            <Button type="submit" className="w-full text-lg" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <User className="h-5 w-5 mr-2" />} 
              Access Status
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Are you an agency staff member? <Link to="/login" className="text-primary hover:underline">Login here</Link>.
            </p>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default CandidateLogin;