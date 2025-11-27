import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const CandidateLoginForm: React.FC = () => {
  const { login, isAuthenticated, isLoading: isAuthLoading, candidateTrackingCode } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(''); // Can be email or tracking code
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  React.useEffect(() => {
    // If already authenticated as a candidate, redirect immediately
    if (isAuthenticated && candidateTrackingCode) {
      navigate(`/track/${candidateTrackingCode}`, { replace: true });
    }
  }, [isAuthenticated, candidateTrackingCode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifierValue = identifier.trim();
    const pinValue = pin.trim();

    if (!identifierValue || !pinValue) {
        toast.error("Please enter both identifier (Email or Tracking Code) and PIN.");
        return;
    }
    
    setIsLoggingIn(true);
    
    const { error } = await login(identifierValue, pinValue);
    setIsLoggingIn(false);

    if (error) {
        toast.error("Login failed. Check your identifier and PIN (Default PIN is 123456).");
        console.error("Supabase Login Error:", error);
    } else {
        // Success handled by useEffect redirect
        toast.success("Login successful!");
    }
  };
  
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <CardContent className="space-y-6 p-0">
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or Tracking Code</Label>
          <Input 
            id="identifier" 
            type="text" 
            placeholder="e.g., TRK-ET-0001 or aster.bekele@candidate.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            disabled={isLoggingIn}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin">PIN (Password)</Label>
          <Input 
            id="pin" 
            type="password" 
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            disabled={isLoggingIn}
          />
        </div>
        <Button type="submit" className="w-full text-lg" disabled={isLoggingIn}>
          {isLoggingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <User className="h-5 w-5 mr-2" />} 
          Login to Status
        </Button>
      </form>
      <div className="text-center text-xs text-gray-500 pt-2 border-t mt-4">
        <p className="font-semibold">Use your registered email or tracking code and PIN (Default: 123456).</p>
      </div>
    </CardContent>
  );
};

export default CandidateLoginForm;