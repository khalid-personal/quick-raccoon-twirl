import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import ThemeToggle from '@/components/ThemeToggle';
import ViewAsButton from '@/components/ViewAsButton';
import { Bell, Check, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Pencil, UserCog, Clock } from 'lucide-react';
import { useLayoutEdit } from '@/lib/layout-edit';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useAddisAbabaTime } from '@/hooks/use-addis-ababa-time';
import { Notification, StaffUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProfileEditorDialog from './ProfileEditorDialog';
import DawmBrand from './DawmBrand';
import FeatureInfo from './FeatureInfo';
import { evidenceNotificationScope } from '@/lib/evidence-notifications';
import AvatarActivity from './AvatarActivity';
import AgencyResolutionCenter from './AgencyResolutionCenter';
import { navigationItemClass } from './ui/navigation-rail';
import PortalBackdrop from './PortalBackdrop';

export interface ShellNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeTone?: 'green' | 'yellow' | 'red';
  hidden?: boolean;
  // Items without a route (e.g. dialog launchers) use onClick instead.
  onClick?: () => void;
}

export interface ShellNavGroup {
  label?: string;
  items: ShellNavItem[];
}

interface AppShellProps {
  portalName: string;
  homePath: string;
  navGroups: ShellNavGroup[];
  children: React.ReactNode;
  // Extra controls rendered in the top bar before the notification bell.
  topBarExtra?: React.ReactNode;
  // Extra dialogs rendered once at the end of the shell.
  overlays?: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrator',
  staff: 'Staff',
  'local-agency': 'Local Agency',
  agency: 'Foreign Agency',
  'foreign-agency': 'Foreign Agency',
  'foreign-agency-staff': 'Agency Staff',
  viewer: 'Viewer',
  auditor: 'Auditor',
  candidate: 'Candidate',
};

const initialsOf = (value: string) =>
  value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';

const isItemActive = (pathname: string, item: ShellNavItem, homePath: string) => {
  if (item.to === '#') return false;
  if (item.to === homePath) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
};

export const SidebarContent: React.FC<{
  portalName: string;
  homePath: string;
  navGroups: ShellNavGroup[];
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}> = ({ portalName, homePath, navGroups, collapsed, pathname, onNavigate }) => (
  <div className="portal-sidebar flex h-full flex-col text-sidebar-foreground">
    <Link to={homePath} onClick={onNavigate} aria-label="DAWM Portal home" className={cn('flex h-16 items-center border-b border-sidebar-border px-4', collapsed ? 'justify-center px-0' : '')}>
      {collapsed
        ? <DawmBrand appearance="dark" compact iconOnly />
        : <DawmBrand appearance="dark" compact subtitle={portalName} />}
    </Link>
    <nav aria-label={`${portalName} menu`} className={cn('navigation-rail navigation-rail-sidebar flex-1 space-y-5 overflow-y-auto px-2 py-4', collapsed && 'navigation-rail-sidebar-collapsed')}>
      {navGroups.map((group, groupIndex) => {
        const items = group.items.filter(item => !item.hidden);
        if (items.length === 0) return null;
        return (
          <div key={group.label ?? groupIndex} className="space-y-0.5">
            {group.label && !collapsed && (
              <p className="portal-sidebar-group px-3 pb-2 font-semibold">{group.label}</p>
            )}
            {items.map(item => {
              const active = isItemActive(pathname, item, homePath);
              const content = (
                <>
                  <span aria-hidden="true" className="navigation-rail-icon shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && !!item.badge && item.badge > 0 && (
                    <span className="navigation-rail-count">
                      {item.badge}
                    </span>
                  )}
                  {collapsed && !!item.badge && item.badge > 0 && (
                    <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-sidebar-primary" />
                  )}
                </>
              );
              const classes = navigationItemClass(active, 'group gap-3');
              const navigation = item.to === '#' ? (
                <button key={item.label} type="button" title={item.label} aria-label={item.label} className={cn(classes, 'w-full text-left')} onClick={() => { item.onClick?.(); onNavigate?.(); }}>
                  {content}
                </button>
              ) : (
                <Link key={item.to} to={item.to} title={item.label} aria-label={item.label} aria-current={active ? 'page' : undefined} className={classes} onClick={() => { item.onClick?.(); onNavigate?.(); }}>
                  {content}
                </Link>
              );
              return <div key={item.to === '#' ? item.label : item.to} className={cn('flex items-center gap-0.5', collapsed && 'flex-col')}>
                <div className="min-w-0 flex-1 self-stretch">{navigation}</div>
                <FeatureInfo title={item.label} className="text-slate-400 hover:bg-white/5 hover:text-white" />
              </div>;
            })}
          </div>
        );
      })}
    </nav>
  </div>
);

const AppShell: React.FC<AppShellProps> = ({ portalName, homePath, navGroups, children, topBarExtra, overlays }) => {
  const { user, logout, userRole, userLocalAgencyId, viewAs, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clock = useAddisAbabaTime();
  const { editing, editable, setEditing } = useLayoutEdit();
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem('dawm_sidebar_collapsed') === '1');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const notificationUserId = viewAs?.userId ?? user?.id;
  const notificationEmail = isDemo ? user?.email : viewAs?.userId ? viewAs.label : user?.email;
  const notificationScope = React.useMemo(() => evidenceNotificationScope(userRole, notificationEmail, userLocalAgencyId), [userRole, notificationEmail, userLocalAgencyId]);

  const { data: currentUser, refetch: refetchUser } = useQuery<StaffUser | null>({
    queryKey: ['currentUser', user?.id],
    queryFn: () => api.getStaffUserById(user!.id),
    enabled: !!user,
  });

  React.useEffect(() => {
    localStorage.setItem('dawm_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!notificationUserId) {
        if (mounted) setNotifications([]);
        return;
      }
      try {
        const result = await api.getNotificationsForUser(notificationUserId, notificationScope);
        if (mounted) setNotifications(result);
      } catch (error) {
        console.warn('[AppShell] failed loading notifications', error);
      }
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener('notifications-changed', load);
    window.addEventListener('bank-statement-changed', load);
    window.addEventListener('focus', load);
    const timer = window.setInterval(load, 60_000);
    return () => {
      mounted = false;
      window.removeEventListener('storage', load);
      window.removeEventListener('notifications-changed', load);
      window.removeEventListener('bank-statement-changed', load);
      window.removeEventListener('focus', load);
      window.clearInterval(timer);
    };
  }, [notificationUserId, notificationScope]);

  const unread = notifications.filter(n => !n.read);
  const sorted = React.useMemo(
    () => [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications],
  );

  const refreshNotifications = async () => {
    if (notificationUserId) setNotifications(await api.getNotificationsForUser(notificationUserId, notificationScope));
  };

  const openNotification = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await api.markNotificationRead(notification.id);
        await refreshNotifications();
      }
    } catch (error) {
      console.warn('[AppShell] failed to mark notification read', error);
    }
    if (notification.link) navigate(notification.link);
  };

  const markAllRead = async () => {
    if (!notificationUserId || unread.length === 0) return;
    try {
      await api.markAllNotificationsReadForUser(notificationUserId, notificationScope);
      await refreshNotifications();
    } catch (error) {
      console.warn('[AppShell] markAllNotificationsRead failed', error);
    }
  };

  const allItems = navGroups.flatMap(group => group.items).filter(item => !item.hidden && item.to !== '#');
  const currentItem = [...allItems].sort((a, b) => b.to.length - a.to.length).find(item => isItemActive(location.pathname, item, homePath));
  const displayName = (currentUser as (StaffUser & { full_name?: string; name?: string }) | undefined)?.full_name
    ?? (currentUser as { name?: string } | undefined)?.name
    ?? user?.user_metadata?.full_name
    ?? user?.email
    ?? 'Account';

  return (
    <div className="portal-shell flex min-h-screen bg-background">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:block', collapsed ? 'w-16' : 'w-64')}>
        <SidebarContent portalName={portalName} homePath={homePath} navGroups={navGroups} collapsed={collapsed} pathname={location.pathname} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 max-w-[calc(100vw-2rem)] border-sidebar-border bg-sidebar p-0 [&>button]:text-white">
          <SidebarContent portalName={portalName} homePath={homePath} navGroups={navGroups} collapsed={false} pathname={location.pathname} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="portal-workspace relative isolate flex min-w-0 flex-1 flex-col">
        <PortalBackdrop />
        <header className="portal-topbar navigation-rail-topbar sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setCollapsed(value => !value)} aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link to={homePath} className="truncate rounded px-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{portalName}</Link>
            {currentItem && currentItem.to !== homePath && (
              <>
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate font-medium">{currentItem.label}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="mr-2 hidden items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground xl:flex">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">{clock}</span>
            </div>
            {editable && (
              <Button
                variant={editing ? 'default' : 'outline'}
                size={editing ? 'sm' : 'icon'}
                className={cn('mr-1', !editing && 'h-8 w-8')}
                aria-label={editing ? 'Finish editing layout' : 'Edit layout'}
                aria-pressed={editing}
                title={editing ? 'Done' : 'Edit layout'}
                onClick={() => setEditing(!editing)}
              >
                {editing ? <><Check className="mr-1 h-4 w-4" />Done</> : <Pencil className="h-4 w-4" />}
              </Button>
            )}
            {topBarExtra}
            <ViewAsButton />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell key={unread.length} className={cn('h-5 w-5 origin-top', unread.length > 0 && 'motion-safe:animate-bell')} />
                  {unread.length > 0 && (
                    <span key={`badge-${unread.length}`} className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold leading-none text-white motion-safe:animate-pop">
                      {unread.length > 9 ? '9+' : unread.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[340px] p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <button className="text-sm font-semibold" onClick={() => navigate('/notifications')}>Notifications</button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead} disabled={unread.length === 0}>Mark all read</Button>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  {sorted.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up</p>
                  ) : (
                    sorted.map(n => (
                      <DropdownMenuItem key={n.id} onClick={() => openNotification(n)} className="flex cursor-pointer items-start gap-2 rounded-none border-b px-3 py-2.5 last:border-0">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-sm leading-snug', !n.read && 'font-medium')}>{n.message}</span>
                          <span className="text-[11px] text-muted-foreground">{formatDistanceToNowStrict(new Date(n.created_at))} ago</span>
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-left transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label="User menu">
                  <Avatar className="h-8 w-8 !overflow-visible">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initialsOf(displayName)}</AvatarFallback>
                    <AvatarActivity id={notificationUserId} kind="staff" lastSeen={currentUser?.last_online_at} />
                  </Avatar>
                  <span className="hidden min-w-0 leading-tight sm:block">
                    <span className="block max-w-[140px] truncate text-sm font-medium">{displayName}</span>
                    <span className="block text-xs text-muted-foreground">{userRole ? ROLE_LABELS[userRole] ?? userRole : ''}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)}><UserCog className="mr-2 h-4 w-4" /> Edit profile</DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="portal-dashboard-content page-enter w-full flex-1"><AgencyResolutionCenter agencyNotice />{children}</main>

        <footer className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Domestic Agency Workforce Management
        </footer>
      </div>

      {currentUser && (
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <ProfileEditorDialog isOpen={profileOpen} onClose={() => setProfileOpen(false)} staffUser={currentUser} onProfileUpdated={() => { refetchUser(); }} />
        </Dialog>
      )}
      {overlays}
    </div>
  );
};

export default AppShell;
