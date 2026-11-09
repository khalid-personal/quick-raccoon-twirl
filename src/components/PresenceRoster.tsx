import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Badge } from '@/components/ui/badge';
import { LastOnline } from '@/components/LastOnline';
import CandidateAvatar from '@/components/CandidateAvatar';
import UserAvatar from './UserAvatar';
import { presenceFor, type PresenceSnapshot } from '@/lib/presence';
import type { AgencyPartnership, CandidateSummary, ForeignAgency, LocalAgency, StaffUser } from '@/lib/types';
import { CandidateWorkspaceLink, EntityProfileButton, useEntityWorkspace } from './CandidateQuickViewProvider';
import { Button } from './ui/button';
import { ArrowUpRight, Users } from 'lucide-react';

interface PresenceRosterProps {
  snapshot: PresenceSnapshot & { shared?: boolean };
  scope: 'admin' | 'local' | 'foreign';
  staff: StaffUser[];
  candidates: CandidateSummary[];
  localAgencies?: LocalAgency[];
  foreignAgencies?: ForeignAgency[];
  partnerships?: AgencyPartnership[];
  localAgencyId?: string | null;
  foreignAgencyId?: string | null;
  candidateBasePath?: string;
}

const PresenceRoster: React.FC<PresenceRosterProps> = ({
  snapshot,
  scope,
  staff,
  candidates,
  localAgencies = [],
  foreignAgencies = [],
  partnerships = [],
  localAgencyId,
  foreignAgencyId,
  candidateBasePath,
}) => {
  const openEntity = useEntityWorkspace();
  const activePartnerships = partnerships.filter(item => item.status === 'active');
  const partnerIds = new Set(scope === 'local'
    ? activePartnerships.filter(item => item.local_agency_id === localAgencyId).map(item => item.foreign_agency_id)
    : scope === 'foreign'
      ? activePartnerships.filter(item => item.foreign_agency_id === foreignAgencyId).map(item => item.local_agency_id)
      : []);
  const approvedStaff = staff.filter(user => user.is_approved);
  const ownStaff = approvedStaff.filter(user => scope === 'admin'
    || (scope === 'local' && user.local_agency_id === localAgencyId)
    || (scope === 'foreign' && user.foreign_agency_id === foreignAgencyId));
  const ownStatus = ownStaff.map(user => ({ user, ...presenceFor(snapshot, 'staff', user.id, user.last_online_at) }))
    .sort((left, right) => Number(right.online) - Number(left.online)
      || Date.parse(right.lastSeen ?? '1970-01-01') - Date.parse(left.lastSeen ?? '1970-01-01'));
  const partnerAgencies = scope === 'local'
    ? foreignAgencies.filter(agency => partnerIds.has(agency.id)).map(agency => ({ id: agency.id, name: agency.name, staff: approvedStaff.filter(user => user.foreign_agency_id === agency.id) }))
    : scope === 'foreign'
      ? localAgencies.filter(agency => partnerIds.has(agency.id)).map(agency => ({ id: agency.id, name: agency.name, staff: approvedStaff.filter(user => user.local_agency_id === agency.id) }))
      : [];
  const partnerStatus = partnerAgencies.map(agency => {
    const states = agency.staff.map(user => presenceFor(snapshot, 'staff', user.id, user.last_online_at));
    const lastSeen = states.map(state => state.lastSeen).filter((value): value is string => !!value)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
    return { ...agency, online: states.some(state => state.online), lastSeen };
  });
  const visibleCandidates = candidates
    .filter(candidate => scope === 'admin'
      || (scope === 'local' && candidate.local_agency_id === localAgencyId)
      || (scope === 'foreign' && (candidate.foreign_agency_id === foreignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === foreignAgencyId))))
    .map(candidate => ({ candidate, ...presenceFor(snapshot, 'candidate', candidate.id) }))
    .filter(item => item.online || item.lastSeen)
    .sort((left, right) => Number(right.online) - Number(left.online)
      || Date.parse(right.lastSeen ?? '1970-01-01') - Date.parse(left.lastSeen ?? '1970-01-01'))
    .slice(0, 6);
  const onlineCount = ownStatus.filter(item => item.online).length;
  const rosterTitle = scope === 'admin' ? 'Staff online' : 'Your team';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="portal-card-heading mb-4 flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl"><Users className="h-6 w-6 text-primary" />{rosterTitle}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {snapshot.shared ? 'Live presence across signed-in accounts' : 'Live in this browser only'}
          </p>
        </div>
        <Badge variant={onlineCount ? 'default' : 'outline'}>{onlineCount} online</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {ownStatus.length ? <div className="space-y-2">
          {ownStatus.slice(0, scope === 'admin' ? 8 : 5).map(({ user, online, lastSeen }) => (
            <div key={user.id} className="flex min-w-0 items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={user} />
                <div className="min-w-0">
                <p className="truncate text-sm font-medium"><EntityProfileButton kind="staff" entityId={user.id}>{user.email}</EntityProfileButton></p>
                <p className="text-xs uppercase text-muted-foreground">{user.role}</p>
                </div>
              </div>
              <LastOnline at={lastSeen} online={online} />
            </div>
          ))}
        </div> : <p className="text-sm text-muted-foreground">No staff accounts in this view.</p>}

        {partnerStatus.length > 0 && <div className="space-y-2 border-t pt-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Partner agencies</h3>
          {partnerStatus.map(agency => (
            <div key={agency.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm"><EntityProfileButton kind={scope === 'local' ? 'foreign-agency' : 'local-agency'} entityId={agency.id}>{agency.name}</EntityProfileButton></span>
              <LastOnline at={agency.lastSeen} online={agency.online} />
            </div>
          ))}
        </div>}

        {visibleCandidates.length > 0 && <div className="space-y-2 border-t pt-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Candidate activity</h3>
          {visibleCandidates.map(({ candidate, online, lastSeen }) => (
            <div key={candidate.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <CandidateAvatar candidate={candidate} className="h-8 w-8" />
                <div className="min-w-0">
                  {candidateBasePath ? <CandidateWorkspaceLink candidateId={candidate.id} className="truncate text-sm font-medium hover:underline" to={`${candidateBasePath}/${candidate.id}`}>{candidate.first_name} {candidate.last_name}</CandidateWorkspaceLink>
                    : <p className="truncate text-sm font-medium">{candidate.first_name} {candidate.last_name}</p>}
                  <p className="font-mono text-[10px] text-muted-foreground">{candidate.tracking_code}</p>
                </div>
              </div>
              <LastOnline at={lastSeen} online={online} />
            </div>
          ))}
        </div>}
        {openEntity ? <Button variant="outline" className="w-full border-primary/30 bg-primary/5" onClick={() => openEntity('staff-directory', 'all')}>Show all staff<ArrowUpRight className="ml-2 h-4 w-4" /></Button> : <p className="text-xs text-muted-foreground">{ownStatus.length} staff in this view</p>}
      </CardContent>
    </Card>
  );
};

export default PresenceRoster;
