import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarDays, Handshake, LayoutDashboard, ListTodo, Map, MessageSquare, Receipt, UserCog, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import AppShell from './AppShell';

export default function LocalAgencyLayout({ children }: { children: React.ReactNode }) {
  const { userLocalAgencyId, userLocalAgencyName } = useAuth();
  const { data: inbox = [] } = useQuery({
    queryKey: ['localAgencyInbox', userLocalAgencyId],
    enabled: !!userLocalAgencyId,
    queryFn: async () => {
      const [messages, candidates] = await Promise.all([api.getAdminInboxSummary(), api.searchCandidates('')]);
      const ids = new Set(candidates.filter(candidate => candidate.local_agency_id === userLocalAgencyId).map(candidate => candidate.id));
      return messages.filter(message => ids.has(message.candidate_id));
    },
    refetchInterval: 10000,
  });
  return <AppShell portalName={userLocalAgencyName || 'Local Agency'} homePath="/local-agency" navGroups={[{
    label: 'Operations',
    items: [
      { to: '/local-agency', label: 'Dashboard', icon: <LayoutDashboard /> },
      { to: '/local-agency/tasks', label: 'My tasks & team', icon: <ListTodo /> },
      { to: '/local-agency/users', label: 'Staff', icon: <UserCog /> },
      { to: '/local-agency/payments', label: 'Payment History', icon: <Receipt /> },
      { to: '/local-agency/clearance', label: 'Clearance', icon: <BadgeCheck /> },
      { to: '/local-agency/training-map', label: 'Journey Map', icon: <Map /> },
      { to: '/local-agency/chat', label: 'Candidate Chat', icon: <MessageSquare />, badge: inbox.filter(message => message.sender === 'candidate' && !message.is_read_by_admin).length },
      { to: '/local-agency/agency-chat', label: 'Partner Chat', icon: <Handshake /> },
      { to: '/local-agency/attendance', label: 'Attendance', icon: <CalendarDays /> },
      { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
    ],
  }]}>{children}</AppShell>;
}