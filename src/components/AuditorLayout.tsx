import React from 'react';
import { BookOpen, ListTodo, ShieldAlert } from 'lucide-react';
import AppShell, { ShellNavGroup } from './AppShell';

const navGroups: ShellNavGroup[] = [
  {
    label: 'Audit',
    items: [
      { to: '/auditor', label: 'Integrity & Audit', icon: <ShieldAlert /> },
      { to: '/auditor/tasks', label: 'My tasks', icon: <ListTodo /> },
      { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
    ],
  },
];

const AuditorLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppShell portalName="Auditor" homePath="/auditor" navGroups={navGroups}>
    {children}
  </AppShell>
);

export default AuditorLayout;
