import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, BookOpen, Film, LayoutDashboard, ListTodo, Map, MessageSquare, Receipt, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { ChatMessage } from '@/lib/types';
import AppShell, { ShellNavGroup } from './AppShell';

const AgencyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole, userForeignAgencyId } = useAuth();

  const { data: inboxSummary = [] } = useQuery<ChatMessage[]>({
    queryKey: ['adminInboxSummary'],
    queryFn: async () => {
      const [messages, candidates] = await Promise.all([api.getAdminInboxSummary(), api.searchCandidates('')]);
      const candidateIds = new Set(candidates.filter(candidate => candidate.foreign_agency_id === userForeignAgencyId
        || candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)).map(candidate => candidate.id));
      return messages.filter(message => candidateIds.has(message.candidate_id));
    },
    enabled: userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'agency',
    refetchInterval: 10000,
  });
  const unreadChats = inboxSummary.filter(m => m.sender === 'candidate' && !m.is_read_by_admin).length;

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
        { to: '/agency/candidate-chat', label: 'Candidate Chat', icon: <MessageSquare />, badge: unreadChats },
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
