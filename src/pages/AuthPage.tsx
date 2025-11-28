import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StaffLoginForm from '@/components/StaffLoginForm';
import CandidateLoginForm from '@/components/CandidateLoginForm';
import AgencyLoginForm from '@/components/AgencyLoginForm'; // NEW IMPORT
import { MadeWithDyad } from '@/components/made-with-dyad';
import EthiopianFlag from '@/components/EthiopianFlag';

const AuthPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <EthiopianFlag />
          <CardTitle className="text-3xl font-bold">Domestic Agency Workforce Management</CardTitle>
          <CardDescription className="text-lg font-semibold text-primary">(DAWM) Portal Access</CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="staff" className="w-full px-6 pb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="staff">Staff Login</TabsTrigger>
            <TabsTrigger value="candidate">Candidate Login</TabsTrigger>
            <TabsTrigger value="agency">Agency Login</TabsTrigger> {/* NEW TAB */}
          </TabsList>
          
          <TabsContent value="staff" className="pt-4">
            <h3 className="text-xl font-semibold mb-4">Staff Access</h3>
            <StaffLoginForm />
          </TabsContent>
          
          <TabsContent value="candidate" className="pt-4">
            <h3 className="text-xl font-semibold mb-4">Candidate Tracking Login</h3>
            <CandidateLoginForm />
          </TabsContent>
          
          <TabsContent value="agency" className="pt-4"> {/* NEW CONTENT */}
            <h3 className="text-xl font-semibold mb-4">Foreign Agency Access</h3>
            <AgencyLoginForm />
          </TabsContent>
        </Tabs>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default AuthPage;