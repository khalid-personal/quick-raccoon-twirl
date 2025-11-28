import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const StaffLoginForm: React.FC = () => {
  const { isAuthenticated, login, isLoading, userRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  React.useEffect(() => {
    // Only redirect if authenticated AND the role is confirmed to be staff or admin
    if (isAuthenticated) {
        if (userRole === 'admin' || userRole === 'staff') {
            navigate('/admin', { replace: true });
        } else if (userRole === 'agency') {
            // If they logged in via the staff tab but are an agency, redirect them correctly
            navigate('/agency/dashboard', { replace: true });
        }
    }
  }, [isAuthenticated, userRole, navigate]); // Removed isLoading from dependencies as it's handled by the component's loading state

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
  
  if (isLoading) {
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
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="staff@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        <Button type="submit" className="w-full" disabled={isLoggingIn}>
          {isLoggingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Login'}
        </Button>
      </form>
      
      <div className="text-center text-sm text-muted-foreground">
        Don't have an account? <Link to="/signup" className="text-primary hover:underline">Register here</Link>
      </div>
      
      <div className="text-center text-xs text-gray-500 pt-2 border-t mt-4">
        <p className="font-semibold">Email/PIN are used as Email/Password for Supabase.</p>
      </div>
    </CardContent>
  );
};

export default StaffLoginForm;