import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Chrome, Github } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const Login: React.FC = () => {
  const { isAuthenticated, login, loginWithProvider, isLoading } = useAuth();
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
  
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      await loginWithProvider(provider);
      // The page will redirect, so no further state updates needed here.
    } catch (error) {
      toast.error((error as Error).message);
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
          <CardDescription>Enter your credentials or use a social provider to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Social Login Buttons */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => handleSocialLogin('google')}
              disabled={isLoggingIn}
            >
              <Chrome className="h-4 w-4 mr-2" /> Login with Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => handleSocialLogin('github')}
              disabled={isLoggingIn}
            >
              <Github className="h-4 w-4 mr-2" /> Login with GitHub
            </Button>
          </div>
          
          <div className="flex items-center">
            <Separator className="flex-grow" />
            <span className="px-2 text-xs text-muted-foreground">OR</span>
            <Separator className="flex-grow" />
          </div>

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
          
          <p className="text-center text-sm text-muted-foreground">
            <a href="/track" className="hover:underline">Return to Public Tracking</a>
          </p>
          <div className="text-center text-xs text-gray-500 pt-2 border-t mt-4">
            <p>To use social logins, you must enable them in your Supabase project settings.</p>
            <p className="font-semibold">Email/PIN are used as Email/Password for Supabase.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;