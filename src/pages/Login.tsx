import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const Login: React.FC = () => {
  const { isAuthenticated, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      // Redirect authenticated users to the admin dashboard
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

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
        // Supabase errors are often generic for security, but we can display a message.
        toast.error("Login failed. Check your email and PIN.");
        console.error("Supabase Login Error:", error);
    } else {
        // Success handled by useEffect redirect
        toast.success("Login successful!");
    }
  };
  
  if (isLoading) {
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
          <CardTitle>Agency Staff Login</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
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
              {isLoggingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Login with Email/PIN'}
            </Button>
          </form>
          
          <div className="text-center text-sm text-muted-foreground">
            Don't have an account? <Link to="/signup" className="text-primary hover:underline">Register here</Link>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/track" className="hover:underline">Return to Public Tracking</Link>
          </p>
          <div className="text-center text-xs text-gray-500 pt-2 border-t mt-4">
            <p className="font-semibold">Email/PIN are used as Email/Password for Supabase.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;