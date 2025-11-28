import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api'; // NEW IMPORT

const Signup: React.FC = () => {
  const { signup, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pin || pin.length < 6) {
        toast.error("Please enter a valid email and a PIN of at least 6 characters.");
        return;
    }
    if (!authCode.trim()) {
        toast.error("Authorization Code is required to register.");
        return;
    }
    
    setIsSigningUp(true);
    try {
        // Validate the authorization code first
        const validatedCode = await api.validateAuthorizationCode(authCode.trim());
        
        // If validation passes, proceed with signup
        const { error } = await signup(email, pin, authCode.trim());
        
        if (error) {
            toast.error(`Registration failed: ${error.message}`);
            console.error("Supabase Signup Error:", error);
        } else {
            toast.success("Registration successful! Your account is pending admin review. You will be notified once approved.");
            navigate('/login');
        }
    } catch (error) {
        toast.error(`Authorization Code Error: ${(error as Error).message}`);
        console.error("Authorization Code Validation Error:", error);
    } finally {
        setIsSigningUp(false);
    }
  };
  
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Staff Registration</CardTitle>
          <CardDescription>Create a new staff account. Approval is required by an administrator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="new.staff@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSigningUp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (Min 6 characters)</Label>
              <Input 
                id="pin" 
                type="password" 
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                minLength={6}
                disabled={isSigningUp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authCode">Authorization Code *</Label>
              <Input 
                id="authCode" 
                type="text" 
                placeholder="Agency/Station Code"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                required
                disabled={isSigningUp}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSigningUp}>
              {isSigningUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Register Account
            </Button>
          </form>
          
          <div className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Login here</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;