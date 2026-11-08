import React from 'react';
import { BadgeCheck, BookOpen, Film, LayoutDashboard, ListTodo, Map, MessageSquare, Receipt, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AppShell, { ShellNavGroup } from './AppShell';

const AgencyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole } = useAuth();

  const navGroups: ShellNavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { to: '/agency', label: 'Dashboard', icon: <LayoutDashboard /> },
        { to: '/agency/tasks', label: userRole === 'foreign-agency-staff' ? 'My tasks' : 'My tasks & team', icon: <ListTodo /> },
        { to: '/agency/introductions', label: 'Candidate Introductions', icon: <Film /> },
        { to: '/agency/training-map', label: 'Destination Map', icon: <Map /> },
        { to: '/agency/clearance', label: 'Clearance Tracker', icon: <BadgeCheck /> },
        { to: '/agency/payments', label: 'Money sent', icon: <Receipt /> },
        { to: '/agency/users', label: 'Staff Users', icon: <Users /> },
        { to: '/agency/chat', label: 'Partner Chat', icon: <MessageSquare /> },
        { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
      ],
    },
  ];

  return (
    <AppShell portalName="Foreign Agency" homePath="/agency" navGroups={navGroups}>
      {children}
    </AppShell>
  );
};

export default AgencyLayout;
