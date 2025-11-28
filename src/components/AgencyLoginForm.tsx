import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Building, Shuffle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const AgencyLoginForm: React.FC = () => {
  const { login, isAuthenticated, isLoading: isAuthLoading, userRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFetchingRandom, setIsFetchingRandom] = useState(false);

  React.useEffect(() => {
    // If already authenticated as an agency, redirect immediately
    if (isAuthenticated && userRole === 'agency') {
      navigate('/agency/dashboard', { replace: true });
    }
  }, [isAuthenticated, userRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValue = email.trim();
    const pinValue = pin.trim();

    if (!emailValue || !pinValue) {
        toast.error("Please enter both email and PIN.");
        return;
    }
    
    setIsLoggingIn(true);
    
    const { error } = await login(emailValue, pinValue);
    setIsLoggingIn(false);

    if (error) {
        toast.error("Login failed. Check your email and PIN.");
        console.error("Supabase Login Error:", error);
    } else {
        // Success handled by useEffect redirect
        toast.success("Login successful!");
    }
  };
  
  const handleRandomAgency = async () => {
    setIsFetchingRandom(true);
    try {
        const agencies = await api.getForeignAgencies();
        if (agencies.length === 0) {
            toast.error("No foreign agencies configured.");
            return;
        }
        // Mock agency login email based on agency name
        const randomAgency = agencies[Math.floor(Math.random() * agencies.length)];
        const mockEmail = `${randomAgency.toLowerCase().split(' ')[0]}@agency.com`;
        
        setEmail(mockEmail);
        setPin('123456');
        toast.info(`Loaded mock agency: ${mockEmail}`);
    } catch (error) {
        toast.error((error as Error).message);
    } finally {
        setIsFetchingRandom(false);
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
          <Label htmlFor="email">Agency Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="agency@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoggingIn || isFetchingRandom}
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
            disabled={isLoggingIn || isFetchingRandom}
          />
        </div>
        <Button type="submit" className="w-full text-lg" disabled={isLoggingIn || isFetchingRandom}>
          {isLoggingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Building className="h-5 w-5 mr-2" />} 
          Agency Login
        </Button>
      </form>
      
      <Button 
        onClick={handleRandomAgency} 
        variant="outline" 
        className="w-full"
        disabled={isLoggingIn || isFetchingRandom}
      >
        {isFetchingRandom ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shuffle className="h-4 w-4 mr-2" />}
        Load Random Agency (Test)
      </Button>
      
      <div className="text-center text-xs text-gray-500 pt-2 border-t mt-4">
        <p className="font-semibold">Use your registered agency email and PIN (Default: 123456).</p>
      </div>
    </CardContent>
  );
};

export default AgencyLoginForm;