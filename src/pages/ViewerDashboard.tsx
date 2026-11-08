import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Eye, ListTodo } from 'lucide-react';
import AppShell from '@/components/AppShell';
import ControlRoomHeader from '@/components/ControlRoomHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ViewerDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const navigate = useNavigate();
  return <AppShell portalName="Viewer" homePath="/viewer" navGroups={[{ label: 'Workspace', items: [
    { to: '/viewer', label: 'Tracking', icon: <Eye /> }, { to: '/viewer/tasks', label: 'My tasks', icon: <ListTodo /> },
    { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
  ] }]}>
    <div className="space-y-6">
      <ControlRoomHeader
        scope="Viewer · view only"
        description="Look up a candidate using their tracking code. Results depend on the portal's public tracking configuration."
        icon={Eye}
        actions={<Button asChild variant="outline" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10"><Link to="/guide"><BookOpen className="mr-2 h-4 w-4" />Getting started</Link></Button>}
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Candidate tracking</CardTitle>
          <CardDescription>Viewer accounts do not have general access to candidate records. Information shown and tracking availability depend on the portal's public tracking configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault();
            if (code.trim()) navigate(`/public-track/${encodeURIComponent(code.trim())}`);
          }}>
            <Label htmlFor="viewer-tracking-code">Tracking code</Label>
            <Input id="viewer-tracking-code" value={code} onChange={event => setCode(event.target.value)} />
            <Button type="submit" disabled={!code.trim()}><Search className="mr-2 h-4 w-4" />Track candidate</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </AppShell>;
};

export default ViewerDashboard;
