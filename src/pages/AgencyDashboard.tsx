import React from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Building, LogOut } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AgencyDashboard: React.FC = () => {
  const { userRole, user, isLoading, logout } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'agency') {
    return <Navigate to="/login" replace />;
  }
  
  const agencyEmail = user?.email || 'Foreign Agency';
  const agencyName = agencyEmail.split('@')[0].toUpperCase();

  return (
    <div className="min-h-screen container mx-auto py-12 space-y-8">
      <Card className="border-blue-500 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-3xl flex items-center text-blue-600 dark:text-blue-400">
            <Building className="h-7 w-7 mr-3" />
            {agencyName} Portal Dashboard
          </CardTitle>
          <Button onClick={logout} variant="destructive">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Welcome, {agencyEmail}. This is your restricted view of candidate data matched to your agency.
          </p>
          
          <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <h3 className="font-semibold text-lg mb-2">Feature Placeholder</h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              In a complete system, this area would display a filtered list of candidates matched to {agencyName}, showing only relevant stages (Job Matching, Contract Signing, Visa Processing, Departure).
            </p>
          </div>
          
          <Link to="/track/TRK-ET-0001">
            <Button variant="secondary">View Sample Candidate Tracking</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyDashboard;