import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/page/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Save, LockKeyhole, Settings2, Network, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import { facilityMapsUrl } from '@/lib/ethiopia';
import { ALL_STAGES, CocFacility, ForeignAgency, LocalAgency } from '@/lib/types'; // NEW IMPORT
import type { AgencyPartnership } from '@/lib/types';
import { getCandidates } from '@/lib/data-store';
import { normalizePartnerships } from '@/lib/agency-partnerships';
import { ETHIOPIAN_REGIONS, REGION_NOT_SET, resolveEthiopianRegion } from '@/lib/ethiopia-regions';
import DemoDataCard from '@/components/DemoDataCard';
import MinistrySubmissionSettings from '@/components/MinistrySubmissionSettings';
import AgencyAssignmentNetwork from '@/components/AgencyAssignmentNetwork';

interface AppConfig {
    countryOptions: string[];
    cocFacilities: CocFacility[];
    foreignAgencies: ForeignAgency[];
    localAgencies: LocalAgency[];
    agencyPartnerships?: AgencyPartnership[];
  stageFees?: Record<number, number>;
    stageFeesInitialized?: boolean;
    integrityScoreThresholds?: { greenMin: number; yellowMin: number };
}

const SuperadminSettings: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  // Queries (hooks must be declared unconditionally)
  const { data: config, isLoading } = useQuery({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
  }) as { data: AppConfig | undefined, isLoading: boolean };

  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';
  
  const cocFacilities = config?.cocFacilities ?? [];
  const foreignAgencies = config?.foreignAgencies ?? [];
  const localAgencies = config?.localAgencies ?? [];
  const agencyPartnerships = normalizePartnerships(config?.agencyPartnerships);
  const candidates = getCandidates();
  const originCandidates = candidates.filter(candidate => ['ethiopia', 'et', 'eth'].includes(candidate.country_of_origin.trim().toLowerCase()));
  const originRegion = (candidate: typeof originCandidates[number]) => resolveEthiopianRegion(candidate.home_city, candidate.home_region);
  const [stageFees, setStageFees] = useState<Record<number, number>>({});
  const [integrityScoreThresholds, setIntegrityScoreThresholds] = useState({ greenMin: 85, yellowMin: 60 });

  useEffect(() => {
    if (config) {
      setStageFees(config.stageFees ?? {});
      setIntegrityScoreThresholds(config.integrityScoreThresholds ?? { greenMin: 85, yellowMin: 60 });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (updatedConfig: AppConfig) => {
      const finalConfig = { 
          ...updatedConfig,
          countryOptions: config?.countryOptions ?? [],
          cocFacilities: config?.cocFacilities ?? [],
          agencyPartnerships: config?.agencyPartnerships,
      };
      return api.updateAppConfig(finalConfig, actorId, actorEmail);
    },
    onSuccess: () => {
      toast.success("Application settings updated successfully.");
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      queryClient.invalidateQueries({ queryKey: ['agency-partnership-config'] });
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${(error as Error).message}`);
    },
  });

  const handleSave = () => {
    if (!config) {
      toast.error('Application settings could not be loaded.');
      return;
    }
    if (integrityScoreThresholds.greenMin <= integrityScoreThresholds.yellowMin) {
      toast.error('The green threshold must be higher than the yellow threshold.');
      return;
    }
    // Foreign agencies and Local agencies can be empty, as they are optional for candidates/users
    
    mutation.mutate({ ...config, agencyPartnerships, stageFees, stageFeesInitialized: true, integrityScoreThresholds });
  };

  // Role check and redirect (after hooks declared)
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== 'superadmin') {
    toast.error('Access Denied: You must be a Superadmin to view settings.');
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="settings-console">
      <section className="settings-command-header">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"><Settings2 className="h-4 w-4" />Platform control center</p>
        <PageHeader title="Superadmin Settings" description="Set portal policies. Review ministry-owned directories without changing source records." />
        <div className="settings-command-metrics">
          <div><LockKeyhole className="h-5 w-5" /><strong>{cocFacilities.length}</strong><span>CoC centers · source locked</span></div>
          <div><Network className="h-5 w-5" /><strong>{localAgencies.length + foreignAgencies.length}</strong><span>Agencies · source locked</span></div>
          <div><ShieldCheck className="h-5 w-5" /><strong>{agencyPartnerships.length}</strong><span>Ministry-assigned partners</span></div>
        </div>
        <nav aria-label="Settings sections" className="mt-5 flex flex-wrap gap-2">{[['settings-agencies', 'Agency constellation'], ['settings-origins', 'Ethiopian origins'], ['settings-partnerships', 'Ministry partners'], ['settings-fees', 'Fees'], ['settings-score', 'Review policy']].map(([id, title]) => <a key={id} href={`#${id}`} className="rounded-full border border-white/20 px-4 py-2 text-sm">{title}</a>)}</nav>
      </section>

      <details className="settings-wide-card portal-flow-guide">
        <summary>One journey. Clear ownership. <span>Start-to-finish guide</span></summary>
        <div className="grid gap-4 p-5 text-sm text-muted-foreground md:grid-cols-3">
          <p><strong className="block text-foreground">01 · Source</strong>Ministry / ELMIS owns identity, contacts, centers and agency partnerships. The connection is pending; grey fields are read-only, including practice records.</p>
          <p><strong className="block text-foreground">02 · Evidence</strong>Agencies upload the original contract in Introductions or Documents. Review scanned details before autofill. Identity and emergency contacts stay source-owned.</p>
          <p><strong className="block text-foreground">03 · Readiness</strong>DAWM controls fees and review thresholds, not ministry approvals. Contract uploads, record scores and practice checks never authorize travel. CoC permissions await official documentation.</p>
        </div>
      </details>

      <DemoDataCard />
      <MinistrySubmissionSettings />

      <Card id="settings-origins" className="settings-source-card">
        <CardHeader>
          <CardTitle>Ethiopian origin coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />Region and home city · source-owned</p>
          
          <div className="space-y-2">
            <p className="text-sm"><strong>{originCandidates.length}</strong> Ethiopian candidates · <strong>{originCandidates.filter(candidate => candidate.home_city?.trim()).length}</strong> with home cities</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ETHIOPIAN_REGIONS.map(region => (
                <div key={region} className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
                  <span>{region}</span><Badge variant="outline">{originCandidates.filter(candidate => originRegion(candidate) === region).length}</Badge>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{originCandidates.filter(candidate => originRegion(candidate) === REGION_NOT_SET).length} need a ministry origin update. DAWM does not invent missing home cities.</p>
        </CardContent>
      </Card>
      
      <Card className="settings-source-card">
        <CardHeader>
          <CardTitle>CoC training & assessment centers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />Candidate-linked ministry directory · read-only</p><fieldset disabled aria-label="Ministry CoC directory" className="space-y-4">
          <div className="space-y-2">
            <Label>Current COC Facilities</Label> {/* Updated Label */}
            <div className="space-y-2">
              {cocFacilities.map((facility) => (
                <div key={facility.id} className="settings-directory-entry space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{facility.name}</span>
                    <LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input aria-label={`${facility.name} city`} className="col-span-2" value={facility.city || 'City not recorded'} readOnly />
                    <Input aria-label={`${facility.name} latitude`} placeholder="Latitude" value={facility.latitude ?? ''} readOnly />
                    <Input aria-label={`${facility.name} longitude`} placeholder="Longitude" value={facility.longitude ?? ''} readOnly />
                    <Input aria-label={`${facility.name} GPS link`} className="col-span-2" placeholder="GPS link not recorded" value={facility.gps_url ?? ''} readOnly />
                  </div>
                  {facilityMapsUrl(facility) && (
                    <a href={facilityMapsUrl(facility)!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open GPS location</a>
                  )}
                </div>
              ))}
              {!cocFacilities.length && <p className="text-sm text-muted-foreground">Awaiting candidate-linked centers from the ministry. Placeholder centers have been removed.</p>}
            </div>
          </div>

        </fieldset></CardContent>
      </Card>
      
      <AgencyAssignmentNetwork candidates={candidates} localAgencies={localAgencies} foreignAgencies={foreignAgencies} />

      <Card id="settings-partnerships" className="settings-wide-card">
        <CardHeader>
          <CardTitle>Agency partner contracts</CardTitle>
          <p className="text-sm text-muted-foreground">Ministry-assigned · read-only · connection pending</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {localAgencies.map(local => {
            const linked = agencyPartnerships.filter(item => item.local_agency_id === local.id);
            return <section key={local.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-medium">{local.name}</h3><p className="text-xs text-muted-foreground">{linked.length} source assignments</p></div><Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />Ministry-owned</Badge></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {linked.map(partnership => {
                  const foreign = foreignAgencies.find(agency => agency.id === partnership.foreign_agency_id);
                  return <div key={partnership.foreign_agency_id} className="min-w-0 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="font-medium">{foreign?.name ?? 'Source agency unavailable'}</p>
                    <p className="break-words text-xs text-muted-foreground">{partnership.agreement_reference || 'Reference not supplied'}</p>
                    <Badge variant="outline" className="mt-2">{partnership.status}</Badge>
                  </div>;
                })}
              </div>
              {!linked.length && <p className="text-sm text-muted-foreground">No ministry-assigned partners supplied.</p>}
            </section>;
          })}
          {!localAgencies.length && <p className="text-sm text-muted-foreground">Awaiting ministry agency assignments.</p>}
        </CardContent>
      </Card>

      <Card id="settings-fees">
        <CardHeader>
          <CardTitle>Candidate Stage Fees</CardTitle>
          <p className="text-sm text-muted-foreground">Set a separate ETB fee for each service. Leave blank when no fee is charged.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ALL_STAGES.map(stage => (
            <div key={stage.id} className="settings-policy-row">
              <Label htmlFor={`stage-fee-${stage.id}`}>{stage.title}</Label>
              <Input
                id={`stage-fee-${stage.id}`}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="No fee"
                value={stageFees[stage.id] ?? ''}
                disabled={mutation.isPending}
                onChange={(event) => {
                  const rawValue = event.currentTarget.value;
                  setStageFees(current => {
                    const next = { ...current };
                    const amount = Number(rawValue);
                    if (!rawValue || !Number.isFinite(amount) || amount <= 0) {
                      delete next[stage.id];
                    } else {
                      next[stage.id] = amount;
                    }
                    return next;
                  });
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card id="settings-score">
        <CardHeader>
          <CardTitle>Record check score colors</CardTitle>
          <p className="text-sm text-muted-foreground">Choose the lowest scores that show green and yellow. Scores below the yellow starting score show red. These colors do not grant approval.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="settings-policy-row">
            <Label htmlFor="integrity-green-min" className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />Green from</Label>
            <Input id="integrity-green-min" type="number" min="1" max="100" value={integrityScoreThresholds.greenMin} disabled={mutation.isPending} onChange={event => setIntegrityScoreThresholds(value => ({ ...value, greenMin: Number(event.target.value) }))} />
          </div>
          <div className="settings-policy-row">
            <Label htmlFor="integrity-yellow-min" className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" />Yellow from</Label>
            <Input id="integrity-yellow-min" type="number" min="0" max="99" value={integrityScoreThresholds.yellowMin} disabled={mutation.isPending} onChange={event => setIntegrityScoreThresholds(value => ({ ...value, yellowMin: Number(event.target.value) }))} />
          </div>
          <p className="text-xs text-muted-foreground">Red applies below yellow. The score is based on current record warnings.</p>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        disabled={mutation.isPending}
        className="settings-save-button"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save All Settings
      </Button>
    </div>
  );
};

export default SuperadminSettings;