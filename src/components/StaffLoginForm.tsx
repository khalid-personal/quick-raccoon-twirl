import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import AuthPasswordInput from './AuthPasswordInput';

const StaffLoginForm: React.FC = () => {
  const { isAuthenticated, login, isLoading: isAuthLoading, userRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  React.useEffect(() => {
    // Redirect users to the appropriate dashboard once authenticated and role resolved
    if (isAuthLoading) return;
    if (!isAuthenticated) return;

    switch (userRole) {
      case 'superadmin':
      case 'admin':
      case 'staff':
        navigate('/admin', { replace: true });
        break;
      case 'foreign-agency':
      case 'agency':
      case 'foreign-agency-staff':
        navigate('/agency', { replace: true });
        break;
      case 'local-agency':
        navigate('/local-agency', { replace: true });
        break;
      case 'auditor':
        navigate('/auditor', { replace: true });
        break;
      case 'viewer':
        navigate('/viewer', { replace: true });
        break;
      default:
        console.warn(`Unhandled role: ${userRole}`);
        toast.error('Access Denied: Unrecognized role.');
        navigate('/login', { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, userRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pin) {
        toast.error("Please enter both email and PIN.");
        return;
    }
    
    setIsLoggingIn(true);
    const { error } = await login(email, pin);
    setIsLoggingIn(false);

    if (error) {
        toast.error("Login failed. Check your email and PIN.");
        console.error("Supabase Login Error:", error);
    } else {
        // Success handled by useEffect redirect
        toast.success("Login successful!");
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
      
      {/* Email/PIN Login Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="staff-email">Email</Label>
          <Input 
            id="staff-email"
            autoComplete="username"
            type="email" 
            placeholder="staff@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoggingIn}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-pin">PIN (Password)</Label>
          <AuthPasswordInput
            id="staff-pin"
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            disabled={isLoggingIn}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoggingIn}>
          {isLoggingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isLoggingIn ? 'Signing in…' : 'Sign in to workspace'}
        </Button>
      </form>
      
      <div className="text-center text-sm text-muted-foreground">
        Don't have an account? <Link to="/signup" className="text-primary hover:underline">Register here</Link>
      </div>
      
      <div className="text-left text-xs text-muted-foreground pt-3 border-t">
        <p>Use your approved account email and PIN. Your role and agency determine which tools are available.</p>
      </div>
    </CardContent>
  );
};

export default StaffLoginForm;