import { useAuth } from '@/lib/auth-context';
import AuditorLayout from '@/components/AuditorLayout';
import AppShell from '@/components/AppShell';
import PortalWorkQueue from '@/components/PortalWorkQueue';
import PageHeader from '@/components/page/PageHeader';
import { BookOpen, Eye, ListTodo } from 'lucide-react';

export default function ReviewTasksPage() {
  const { userRole } = useAuth();
  const content = <div className="space-y-6"><PageHeader title="My tasks" description="Read-only review and follow-up within your account’s permissions." /><PortalWorkQueue /></div>;
  return userRole === 'auditor' ? <AuditorLayout>{content}</AuditorLayout>
    : <AppShell portalName="Viewer" homePath="/viewer" navGroups={[{ label: 'Workspace', items: [
      { to: '/viewer', label: 'Tracking', icon: <Eye /> }, { to: '/viewer/tasks', label: 'My tasks', icon: <ListTodo /> },
      { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
    ] }]}>{content}</AppShell>;
}
