import { BookOpen, CalendarDays, Handshake, LayoutDashboard, ListTodo, Map, Receipt, UserCog, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AppShell from './AppShell';

export default function LocalAgencyLayout({ children }: { children: React.ReactNode }) {
  const { userLocalAgencyName } = useAuth();
  return <AppShell portalName={userLocalAgencyName || 'Local Agency'} homePath="/local-agency" navGroups={[{
    label: 'Operations',
    items: [
      { to: '/local-agency', label: 'Dashboard', icon: <LayoutDashboard /> },
      { to: '/local-agency/tasks', label: 'My tasks & team', icon: <ListTodo /> },
      { to: '/local-agency/users', label: 'Staff', icon: <UserCog /> },
      { to: '/local-agency/payments', label: 'Payment History', icon: <Receipt /> },
      { to: '/local-agency/clearance', label: 'Clearance', icon: <BadgeCheck /> },
      { to: '/local-agency/training-map', label: 'Journey Map', icon: <Map /> },
      { to: '/local-agency/agency-chat', label: 'Partner Chat', icon: <Handshake /> },
      { to: '/local-agency/attendance', label: 'Attendance', icon: <CalendarDays /> },
      { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
    ],
  }]}>{children}</AppShell>;
}