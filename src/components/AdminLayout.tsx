import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Bell, BookOpen, CalendarDays, ClipboardCheck, Eye, Key, LayoutDashboard, MapPin, Receipt, ShieldAlert, Settings, UserCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppShell, { ShellNavGroup } from './AppShell';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [trackingOpen, setTrackingOpen] = React.useState(false);
  const [trackingCode, setTrackingCode] = React.useState('');
  const isSuperAdmin = userRole === 'superadmin';

  const openTracking = () => {
    const code = trackingCode.trim();
    if (!code) {
      toast.error('Please enter a tracking code.');
      return;
    }
    navigate(`/public-track/${code}`);
    setTrackingOpen(false);
    setTrackingCode('');
  };

  const navGroups: ShellNavGroup[] = [
    {
      label: 'Operations',
      items: [
        { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard /> },
        { to: '/admin/training-map', label: 'CoC Centers', icon: <MapPin /> },
        { to: '/admin/tasks', label: 'My Tasks', icon: <ClipboardCheck /> },
        { to: '/admin/clearance', label: 'Clearance & Visa', icon: <BadgeCheck /> },
        { to: '/admin/payments', label: 'Payments', icon: <Receipt /> },
        { to: '/admin/attendance', label: 'Attendance', icon: <CalendarDays /> },
        { to: '/notifications', label: 'Notifications', icon: <Bell /> },
        { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
        { to: '#', label: 'Public Tracking', icon: <Eye />, onClick: () => setTrackingOpen(true) },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/admin/users', label: 'User Management', icon: <UserCog />, hidden: !isSuperAdmin },
        { to: '/admin/integrity', label: 'Record checks', icon: <ShieldAlert /> },
        { to: '/admin/profile-approvals', label: 'Profile Approvals', icon: <UserCheck />, hidden: !isSuperAdmin },
        { to: '/admin/auth-codes', label: 'Auth Codes', icon: <Key />, hidden: !isSuperAdmin },
        { to: '/admin/settings', label: 'Settings', icon: <Settings />, hidden: !isSuperAdmin },
      ],
    },
  ];

  return (
    <AppShell
      portalName={isSuperAdmin ? 'Administration' : 'Staff Workspace'}
      homePath="/admin"
      navGroups={navGroups}
      overlays={(
        <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> View public tracking</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="tracking-code-input">Candidate tracking code</Label>
              <Input
                id="tracking-code-input"
                placeholder="e.g., TRK-ET-0001"
                value={trackingCode}
                onChange={event => setTrackingCode(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    openTracking();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button type="button" onClick={openTracking}>View tracking</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    >
      {children}
    </AppShell>
  );
};

export default AdminLayout;
