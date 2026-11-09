import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, Shuffle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api'; // Import api
import AuthPasswordInput from './AuthPasswordInput';

const CandidateLoginForm: React.FC = () => {
  const { login, isAuthenticated, isLoading: isAuthLoading, candidateTrackingCode } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(''); // Can be email or tracking code
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFetchingRandom, setIsFetchingRandom] = useState(false);

  React.useEffect(() => {
    // If auth loading is complete, and already authenticated as a candidate, redirect immediately
    if (!isAuthLoading && isAuthenticated && candidateTrackingCode) {
      navigate(`/track/${candidateTrackingCode}`, { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, candidateTrackingCode, navigate]);

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
  
  const handleRandomCandidate = async () => {
    setIsFetchingRandom(true);
    try {
        const randomCandidate = await api.getRandomCandidate();
        setIdentifier(randomCandidate.identifier);
        setPin(randomCandidate.pin);
        toast.info(`Loaded candidate: ${randomCandidate.identifier}`);
    } catch (error) {
        toast.error((error as Error).message);
    } finally {
        setIsFetchingRandom(false);
    }
  };
  
  if (isAuthLoading) { // Use isAuthLoading from useAuth hook
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
            placeholder="Your email or tracking code"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            disabled={isLoggingIn || isFetchingRandom}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="candidate-pin">PIN (Password)</Label>
          <AuthPasswordInput
            id="candidate-pin"
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            disabled={isLoggingIn || isFetchingRandom}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoggingIn || isFetchingRandom}>
          {isLoggingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <User className="h-5 w-5 mr-2" />} 
          {isLoggingIn ? 'Signing in…' : 'Sign in to your journey'}
        </Button>
      </form>
      
      {import.meta.env.DEV && <Button
        onClick={handleRandomCandidate} 
        variant="outline" 
        className="w-full"
        disabled={isLoggingIn || isFetchingRandom}
      >
        {isFetchingRandom ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shuffle className="h-4 w-4 mr-2" />}
        Load Random Candidate (Test)
      </Button>}
      
      <div className="text-left text-xs text-muted-foreground pt-3 border-t">
        <p>Use your registered email or tracking code and the PIN provided by your agency. Demo tools use practice records only.</p>
      </div>
    </CardContent>
  );
};

export default CandidateLoginForm;