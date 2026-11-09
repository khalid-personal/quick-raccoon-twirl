import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, BookOpen, CalendarDays, ClipboardCheck, Eye, LayoutDashboard, MapPin, Receipt, ShieldAlert, Settings, UserCheck, UserCog } from 'lucide-react';
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
      label: 'Daily work',
      items: [
        { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard /> },
        { to: '/admin/tasks', label: isSuperAdmin ? 'Oversight & my tasks' : userRole === 'staff' ? 'My tasks' : 'My tasks & team', icon: <ClipboardCheck /> },
      ],
    },
    {
      label: 'Candidate records',
      items: [
        { to: '/admin/payments', label: 'Payments', icon: <Receipt /> },
        { to: '/admin/clearance', label: 'Visa & clearance', icon: <BadgeCheck /> },
        { to: '/admin/training-map', label: 'Training & journey map', icon: <MapPin /> },
        { to: '/admin/integrity', label: 'Record checks', icon: <ShieldAlert /> },
      ],
    },
    {
      label: 'Communication & help',
      items: [
        { to: '#', label: 'Public tracking', icon: <Eye />, onClick: () => setTrackingOpen(true) },
        { to: '/guide', label: 'Getting started', icon: <BookOpen /> },
      ],
    },
    {
      label: 'Team & access',
      items: [
        { to: '/admin/attendance', label: 'Attendance', icon: <CalendarDays /> },
        { to: '/admin/users', label: 'User management', icon: <UserCog />, hidden: !isSuperAdmin },
        { to: '/admin/profile-approvals', label: 'Profile approvals', icon: <UserCheck />, hidden: !isSuperAdmin },
        { to: '/admin/settings', label: 'Settings', icon: <Settings />, hidden: !isSuperAdmin },
      ],
    },
  ];

  return (
    <AppShell
      portalName={isSuperAdmin ? 'Ministry administration' : userRole === 'admin' ? 'Administrator' : 'Staff workspace'}
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
