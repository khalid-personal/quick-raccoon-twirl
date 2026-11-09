import { BookOpen, CalendarDays, Handshake, LayoutDashboard, ListTodo, Map, Receipt, UserCog, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AppShell from './AppShell';

export default function LocalAgencyLayout({ children }: { children: React.ReactNode }) {
  const { userLocalAgencyName } = useAuth();
  return <AppShell portalName={userLocalAgencyName || 'Local Agency'} homePath="/local-agency" navGroups={[{
    label: 'Daily work',
    items: [
      { to: '/local-agency', label: 'Dashboard', icon: <LayoutDashboard /> },
      { to: '/local-agency/tasks', label: 'My tasks & team', icon: <ListTodo /> },
    ],
  }, {
    label: 'Candidate records',
    items: [
      { to: '/local-agency/payments', label: 'Payments received', icon: <Receipt /> },
      { to: '/local-agency/clearance', label: 'Visa & clearance', icon: <BadgeCheck /> },
      { to: '/local-agency/training-map', label: 'Training & journey map', icon: <Map /> },
    ],
  }, {
    label: 'Communication & help',
    items: [
      { to: '/local-agency/agency-chat', label: 'Partner chat', icon: <Handshake /> },
      { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
    ],
  }, {
    label: 'Team management',
    items: [
      { to: '/local-agency/users', label: 'Staff accounts', icon: <UserCog /> },
      { to: '/local-agency/attendance', label: 'Attendance', icon: <CalendarDays /> },
    ],
  }]}>{children}</AppShell>;
}