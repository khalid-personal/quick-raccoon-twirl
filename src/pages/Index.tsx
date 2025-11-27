import React, { useState } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [trackingCode, setTrackingCode] = useState('');
  const navigate = useNavigate();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/track/${trackingCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Track Your Application</CardTitle>
          <CardDescription>Enter your unique tracking code to view the progress of your domestic worker's deployment.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTrack} className="space-y-4">
            <Input
              placeholder="e.g., TRK-ET-0001"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              className="text-lg p-6"
              required
            />
            <Button type="submit" className="w-full text-lg">
              <Search className="h-5 w-5 mr-2" /> Track Status
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Are you an agency staff member? <a href="/admin/login" className="text-primary hover:underline">Login here</a>.
            </p>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Index;