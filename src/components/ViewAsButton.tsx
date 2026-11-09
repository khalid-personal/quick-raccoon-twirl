import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, Globe2, Search, ShieldCheck, Undo2, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { ViewAsTarget } from '@/lib/auth-context';
import { getCandidates, getForeignAgencies, getLocalAgencies, getStaffUsers } from '@/lib/data-store';
import type { Candidate, StaffUser, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CandidateAvatar from '@/components/CandidateAvatar';
import UserAvatar from '@/components/UserAvatar';

export const homeFor = (role: UserRole, trackingCode?: string | null): string => {
  switch (role) {
    case 'agency':
    case 'foreign-agency':
    case 'foreign-agency-staff': return '/agency';
    case 'local-agency': return '/local-agency';
    case 'auditor': return '/auditor';
    case 'viewer': return '/viewer';
    case 'candidate': return trackingCode ? `/track/${trackingCode}` : '/login?tab=candidate';
    default: return '/admin';
  }
};

interface Entry {
  key: string;
  title: string;
  subtitle: string;
  badge: string;
  target: ViewAsTarget;
  avatar?: Pick<Candidate, 'id' | 'first_name' | 'last_name' | 'profile_image_url' | 'passport_image_url'>;
  userAvatar?: StaffUser;
}

const GROUPS: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: 'role', label: 'Roles', icon: ShieldCheck },
  { id: 'local', label: 'Local agencies', icon: Building2 },
  { id: 'foreign', label: 'Foreign agencies', icon: Globe2 },
  { id: 'staff', label: 'Users', icon: Users },
  { id: 'candidate', label: 'Candidates', icon: UserRound },
];

const ROLE_ENTRIES: Entry[] = (['staff', 'viewer', 'auditor'] as const).map(role => ({
  key: `role-${role}`, title: role.charAt(0).toUpperCase() + role.slice(1), subtitle: 'Generic view of this role', badge: role,
  target: { role, label: role.charAt(0).toUpperCase() + role.slice(1) },
}));

const ViewAsButton: React.FC = () => {
  const { actualRole, viewAs, startViewAs, stopViewAs } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    if (!open) return {} as Record<string, Entry[]>;
    const locals = getLocalAgencies();
    const foreigns = getForeignAgencies();
    const localName = (id?: string) => locals.find(a => a.id === id)?.name;
    const foreignName = (id?: string) => foreigns.find(a => a.id === id)?.name;
    return {
      role: ROLE_ENTRIES,
      local: locals.map<Entry>(a => ({
        key: `l-${a.id}`, title: a.name, subtitle: a.address ?? 'Local agency', badge: 'local-agency',
        target: { role: 'local-agency', label: a.name, localAgencyId: a.id, localAgencyName: a.name },
      })),
      foreign: foreigns.map<Entry>(a => ({
        key: `f-${a.id}`, title: a.name, subtitle: a.address ?? 'Foreign agency', badge: 'foreign-agency',
        target: { role: 'foreign-agency', label: a.name, foreignAgencyId: a.id, foreignAgencyName: a.name },
      })),
      staff: getStaffUsers().filter(u => u.role !== 'superadmin').map<Entry>(u => ({
        key: `u-${u.id}`, title: u.email, subtitle: [localName(u.local_agency_id), foreignName(u.foreign_agency_id)].filter(Boolean).join(' · ') || 'Staff user', badge: u.role,
        userAvatar: u,
        target: {
          role: u.role, label: u.email, userId: u.id,
          localAgencyId: u.local_agency_id, localAgencyName: localName(u.local_agency_id),
          foreignAgencyId: u.foreign_agency_id, foreignAgencyName: foreignName(u.foreign_agency_id),
        },
      })),
      candidate: getCandidates().map<Entry>(c => ({
        key: `c-${c.id}`, title: `${c.first_name} ${c.last_name}`, subtitle: c.tracking_code, badge: 'candidate',
        avatar: c,
        target: {
          role: 'candidate', label: `${c.first_name} ${c.last_name}`, trackingCode: c.tracking_code,
          localAgencyId: c.local_agency_id, localAgencyName: localName(c.local_agency_id),
          foreignAgencyId: c.foreign_agency_id, foreignAgencyName: foreignName(c.foreign_agency_id),
        },
      })),
    } as Record<string, Entry[]>;
  }, [open]);

  if (actualRole !== 'superadmin') return null;

  const q = query.trim().toLowerCase();
  const exit = () => {
    stopViewAs();
    setOpen(false);
    setQuery('');
    navigate('/admin', { replace: true });
    toast.success('Returned to Superadmin view.');
  };
  const pick = (entry: Entry) => {
    startViewAs(entry.target);
    setOpen(false);
    setQuery('');
    toast.success(`Now viewing as ${entry.target.label}`);
    navigate(homeFor(entry.target.role, entry.target.trackingCode));
  };

  return (
    <>
      {viewAs && <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="sm" onClick={exit} aria-label="Exit View As"><Undo2 className="h-4 w-4" /><span className="ml-2 hidden sm:inline">Exit View As</span></Button></TooltipTrigger><TooltipContent>Return to Superadmin</TooltipContent></Tooltip>}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={viewAs ? 'default' : 'ghost'} size="icon" aria-label="View as another user" onClick={() => setOpen(true)}>
            <Eye className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View as another user</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>View as…</DialogTitle>
            <DialogDescription>See the portal exactly as another role, agency, user or candidate would. Your own session stays signed in.</DialogDescription>
          </DialogHeader>
          {viewAs && <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><p className="text-sm text-muted-foreground">Viewing as {viewAs.label}</p><Button type="button" variant="outline" size="sm" onClick={exit}><Undo2 className="mr-2 h-4 w-4" />Return to Superadmin</Button></div>}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus className="pl-9" placeholder="Search agency, email, candidate or tracking code" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {GROUPS.map(({ id, label, icon: Icon }) => {
              const all = entries[id] ?? [];
              const matches = q ? all.filter(e => `${e.title} ${e.subtitle} ${e.badge}`.toLowerCase().includes(q)) : all;
              const shown = matches.slice(0, q ? 30 : 6);
              if (!shown.length) return null;
              return (
                <section key={id} className="space-y-1">
                  <h4 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" /> {label} <span className="font-normal normal-case">({matches.length})</span>
                  </h4>
                  {shown.map(entry => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => pick(entry)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {entry.avatar && <CandidateAvatar candidate={entry.avatar} className="h-8 w-8" />}
                        {entry.userAvatar && <UserAvatar user={entry.userAvatar} className="h-8 w-8" />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{entry.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{entry.subtitle}</span>
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0">{entry.badge}</Badge>
                    </button>
                  ))}
                  {!q && matches.length > shown.length && <p className="px-3 text-xs text-muted-foreground">Search to see {matches.length - shown.length} more…</p>}
                </section>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ViewAsButton;
