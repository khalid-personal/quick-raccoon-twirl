import React from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Building, LogOut, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AgencyLayout from '@/components/AgencyLayout'; // Import the new layout

const AgencyDashboard: React.FC = () => {
  const { userRole, user, isLoading, logout, userForeignAgency } = useAuth();
  
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
  const agencyName = userForeignAgency || agencyEmail.split('@')[0].toUpperCase();

  return (
    <AgencyLayout> {/* Use the new AgencyLayout */}
      <Card className="border-blue-500 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-3xl flex items-center text-blue-600 dark:text-blue-400">
            <Building className="h-7 w-7 mr-3" />
            {agencyName} Portal Dashboard
          </CardTitle>
          {/* Logout button is now in the layout, but keeping this for consistency if needed */}
          {/* <Button onClick={logout} variant="destructive">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Welcome, {agencyEmail}. This is your restricted view of candidate data matched to your agency.
          </p>
          
          <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <h3 className="font-semibold text-lg mb-2">Quick Actions</h3>
            <div className="flex flex-col space-y-2">
                <Link to="/agency/staged-candidates">
                    <Button className="w-full justify-start">
                        <Users className="h-4 w-4 mr-2" /> View Staged Candidates
                    </Button>
                </Link>
                <Link to="/track/TRK-ET-0001">
                    <Button variant="secondary" className="w-full justify-start">
                        <Users className="h-4 w-4 mr-2" /> View Sample Candidate Tracking
                    </Button>
                </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </AgencyLayout>
  );
};

export default AgencyDashboard;