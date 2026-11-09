import React from 'react';
import { BadgeCheck, BookOpen, Film, LayoutDashboard, ListTodo, Map, MessageSquare, Receipt, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AppShell, { ShellNavGroup } from './AppShell';

const AgencyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole } = useAuth();

  const navGroups: ShellNavGroup[] = [
    {
      label: 'Daily work',
      items: [
        { to: '/agency', label: 'Dashboard', icon: <LayoutDashboard /> },
        { to: '/agency/tasks', label: userRole === 'foreign-agency-staff' ? 'My tasks' : 'My tasks & team', icon: <ListTodo /> },
      ],
    },
    {
      label: 'Candidates & transfers',
      items: [
        { to: '/agency/introductions', label: 'Candidate introductions', icon: <Film /> },
        { to: '/agency/training-map', label: 'Destination map', icon: <Map /> },
        { to: '/agency/clearance', label: 'Clearance tracker', icon: <BadgeCheck /> },
        { to: '/agency/payments', label: 'Money sent', icon: <Receipt /> },
      ],
    },
    {
      label: 'Communication & help',
      items: [
        { to: '/agency/chat', label: 'Partner chat', icon: <MessageSquare /> },
        { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
      ],
    },
    { label: 'Team management', items: [
      { to: '/agency/users', label: 'Staff accounts', icon: <Users />, hidden: userRole === 'foreign-agency-staff' },
    ] },
  ];

  return (
    <AppShell portalName={userRole === 'foreign-agency-staff' ? 'Foreign agency staff' : 'Foreign agency'} homePath="/agency" navGroups={navGroups}>
      {children}
    </AppShell>
  );
};

export default AgencyLayout;
