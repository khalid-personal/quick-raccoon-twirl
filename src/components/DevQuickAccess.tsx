import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, Landmark, ShieldCheck, Shuffle, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { getCandidates, getForeignAgencies, getLocalAgencies, getStaffUsers } from '@/lib/data-store';
import { enterDemo, getDemoScenario, VIEW_AS_KEY } from '@/lib/demo-mode';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { isSupabaseDataMode } from '@/lib/supabase-sync';
import type { StaffUser } from '@/lib/types';
import { toast } from 'sonner';

const DevQuickAccess: React.FC = () => {
  const { loginAsDevelopmentUser } = useAuth();
  const navigate = useNavigate();
  const [foreignAgencyId, setForeignAgencyId] = useState('');
  const [localAgencyId, setLocalAgencyId] = useState('');
  const [busy, setBusy] = useState(false);

  const localDemo = !isSupabaseDataMode();
  const demo = useMemo(() => localDemo ? generateDemoDataset(Date.now(), getDemoScenario()) : null, [localDemo]);
  const staffUsers = (demo?.staffUsers ?? getStaffUsers()).filter(user => user.is_approved);
  const candidates = demo?.candidates ?? getCandidates();
  const foreignAgencies = demo?.foreignAgencies ?? getForeignAgencies();
  const localAgencies = demo?.localAgencies ?? getLocalAgencies();

  const loginAs = async (account: StaffUser | undefined, route: string) => {
    if (!account) {
      toast.error('No seeded account is available for that role.');
      return;
    }

    if (localDemo) {
      const local = localAgencies.find(agency => agency.id === account.local_agency_id);
      const foreign = foreignAgencies.find(agency => agency.id === account.foreign_agency_id);
      sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify({
        role: account.role, label: account.email, userId: account.id,
        localAgencyId: local?.id, localAgencyName: local?.name,
        foreignAgencyId: foreign?.id, foreignAgencyName: foreign?.name,
      }));
      enterDemo(route);
      return;
    }

    setBusy(true);
    try {
      const { error } = await loginAsDevelopmentUser(account.email);
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate(route, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const randomCandidate = () => candidates[Math.floor(Math.random() * candidates.length)];

  const loginAsRandomCandidate = async () => {
    const candidate = randomCandidate();
    if (!candidate) {
      toast.error('No seeded candidates are available.');
      return;
    }

    if (localDemo) {
      sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify({ role: 'candidate', label: `${candidate.first_name} ${candidate.last_name}`, trackingCode: candidate.tracking_code }));
      enterDemo(`/track/${candidate.tracking_code}`);
      return;
    }

    setBusy(true);
    try {
      const { error } = await loginAsDevelopmentUser(candidate.email);
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate(`/track/${candidate.tracking_code}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const openRandomCandidateViewer = () => {
    const candidate = randomCandidate();
    if (!candidate) {
      toast.error('No seeded candidates are available.');
      return;
    }
    if (localDemo) {
      sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify({ role: 'viewer', label: 'Viewer' }));
      enterDemo(`/viewer?code=${encodeURIComponent(candidate.tracking_code)}`);
      return;
    }
    navigate(`/viewer?code=${encodeURIComponent(candidate.tracking_code)}`);
  };

  const foreignAccount = staffUsers.find(user =>
    (user.role === 'foreign-agency' || user.role === 'foreign-agency-staff') && user.foreign_agency_id === foreignAgencyId,
  );
  const localAccount = staffUsers.find(user => user.role === 'local-agency' && user.local_agency_id === localAgencyId);

  return (
    <section className="mx-6 mb-6 border-t pt-4" aria-label="Development quick access">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Development Quick Access</h2>
        <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">DEV</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => {
          if (localDemo) { sessionStorage.removeItem(VIEW_AS_KEY); enterDemo('/admin'); }
          else void loginAs(staffUsers.find(user => user.role === 'superadmin'), '/admin');
        }}>
          <ShieldCheck className="h-4 w-4" /> Superadmin
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void loginAs(staffUsers.find(user => user.role === 'staff'), '/admin')}>
          <UserCog className="h-4 w-4" /> Staff
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void loginAsRandomCandidate()}>
          <Shuffle className="h-4 w-4" /> Random Candidate
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={openRandomCandidateViewer}>
          <Eye className="h-4 w-4" /> Random Viewer
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Select value={foreignAgencyId} onValueChange={setForeignAgencyId} disabled={busy || foreignAgencies.length === 0}>
          <SelectTrigger aria-label="Foreign agency">
            <SelectValue placeholder="Choose foreign agency" />
          </SelectTrigger>
          <SelectContent>
            {foreignAgencies.map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" disabled={busy || !foreignAccount} onClick={() => void loginAs(foreignAccount, '/agency')}>
          <Building2 className="h-4 w-4" /> Foreign
        </Button>

        <Select value={localAgencyId} onValueChange={setLocalAgencyId} disabled={busy || localAgencies.length === 0}>
          <SelectTrigger aria-label="Local agency">
            <SelectValue placeholder="Choose local agency" />
          </SelectTrigger>
          <SelectContent>
            {localAgencies.map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" disabled={busy || !localAccount} onClick={() => void loginAs(localAccount, '/local-agency')}>
          <Landmark className="h-4 w-4" /> Local
        </Button>
      </div>
    </section>
  );
};

export default DevQuickAccess;