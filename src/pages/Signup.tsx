import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import AuthPasswordInput from '@/components/AuthPasswordInput';
import DawmBrand from '@/components/DawmBrand';

const Signup: React.FC = () => {
  const { signup, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
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
    
    setIsSigningUp(true);
    const { error } = await signup(email, pin);
    setIsSigningUp(false);

    if (error) {
        toast.error(`Registration failed: ${error.message}`);
        console.error("Supabase Signup Error:", error);
    } else {
        toast.success("Registration successful! Your account is pending admin review. You will be notified once approved.");
        navigate('/login');
    }
  };
  
  if (authLoading) {
    return (
      <div className="dawm-auth auth-main min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="dawm-auth auth-main min-h-screen flex items-center justify-center p-5">
      <Card className="auth-access-card w-full max-w-md rounded-3xl">
        <CardHeader className="space-y-3">
          <DawmBrand compact subtitle="Staff access" />
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
                autoComplete="username"
                required
                disabled={isSigningUp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (Min 6 characters)</Label>
              <AuthPasswordInput
                id="pin" 
                placeholder="••••••"
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                minLength={6}
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