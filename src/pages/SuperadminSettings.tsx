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
import { Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import ExternalSystemSimulator from '@/components/ExternalSystemSimulator';
import { ETHIOPIAN_CITIES, facilityMapsUrl } from '@/lib/ethiopia';
import { ALL_STAGES, CocFacility, ForeignAgency, LocalAgency } from '@/lib/types'; // NEW IMPORT
import type { AgencyPartnership } from '@/lib/types';
import { getCandidates, isSeedDisabled, setSeedDisabled } from '@/lib/data-store';
import { MAX_AGENCY_PARTNERS, normalizePartnerships, validatePartnerships } from '@/lib/agency-partnerships';
import DemoDataCard from '@/components/DemoDataCard';
import MinistrySubmissionSettings from '@/components/MinistrySubmissionSettings';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid'; // NEW IMPORT
import { WORLD_COUNTRIES } from '@/lib/countries';
import CountryFlag from '@/components/CountryFlag';
import SearchableCountrySelect from '@/components/SearchableCountrySelect';

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
  
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  
  const [cocFacilities, setCocFacilities] = useState<CocFacility[]>([]);
  const [newCocFacilityName, setNewCocFacilityName] = useState(''); // For new facility name

  const [foreignAgencies, setForeignAgencies] = useState<ForeignAgency[]>([]);
  const [localAgencies, setLocalAgencies] = useState<LocalAgency[]>([]);
  const [agencyPartnerships, setAgencyPartnerships] = useState<AgencyPartnership[]>([]);
  const [stageFees, setStageFees] = useState<Record<number, number>>({});
  const [integrityScoreThresholds, setIntegrityScoreThresholds] = useState({ greenMin: 85, yellowMin: 60 });
  const [disableSeedToggle, setDisableSeedToggleState] = useState(false);

  useEffect(() => {
    if (config) {
      // Filter out 'Other' as it's a special case not meant for direct editing here
      setCountryOptions((config.countryOptions ?? []).filter(c => c !== 'Other'));
      setCocFacilities(config.cocFacilities ?? []);
      setForeignAgencies(config.foreignAgencies ?? []);
      setLocalAgencies(config.localAgencies ?? []);
      setAgencyPartnerships(normalizePartnerships(config.agencyPartnerships, getCandidates()));
      setStageFees(config.stageFees ?? {});
      setIntegrityScoreThresholds(config.integrityScoreThresholds ?? { greenMin: 85, yellowMin: 60 });
    }
    // initialize seed toggle state from data-store/localStorage
    try {
      setDisableSeedToggleState(isSeedDisabled());
    } catch (e) {
      console.warn('Could not read seed toggle state', e);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (updatedConfig: AppConfig) => {
      // Re-add 'Other' to country options before saving
      const finalCountryOptions = [...updatedConfig.countryOptions, 'Other'];
      const finalConfig = { 
          ...updatedConfig,
          countryOptions: finalCountryOptions, 
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

  const handleAddCountry = () => {
    const trimmedCountry = newCountry.trim();
    if (!trimmedCountry) return;
    addCountryOption(trimmedCountry);
    setNewCountry('');
  };

  const handleRemoveCountry = (countryToRemove: string) => {
    setCountryOptions(countryOptions.filter(c => c !== countryToRemove));
  };

  const addCountryOption = (country: string) => {
    const trimmedCountry = country.trim();
    if (!trimmedCountry) return;

    const normalizeCountryName = (value: string) =>
      value.replace(/\s+\([A-Z]{2}\)$/, '').trim().toLocaleLowerCase();
    const existingIndex = countryOptions.findIndex(existing =>
      normalizeCountryName(existing) === normalizeCountryName(trimmedCountry),
    );
    if (existingIndex >= 0 && countryOptions[existingIndex] === trimmedCountry) {
      toast.warning('This country is already in the list.');
      return;
    }

    if (existingIndex >= 0) {
      setCountryOptions(current => current.map((existing, index) => index === existingIndex ? trimmedCountry : existing));
      toast.success('Country updated with its ISO code.');
      return;
    }

    setCountryOptions(current => [...current, trimmedCountry]);
  };

  const handleAddWorldCountry = () => {
    const country = WORLD_COUNTRIES.find(option => option.code === selectedCountryCode);
    if (!country) return;
    addCountryOption(`${country.name} (${country.code})`);
    setSelectedCountryCode('');
  };
  
  const handleAddCocFacility = () => { // NEW FUNCTION
    const trimmedName = newCocFacilityName.trim();
    if (!trimmedName) return;
    
    if (cocFacilities.some(f => f.name === trimmedName)) {
        toast.warning("This COC facility is already in the list.");
        return;
    }
    
    setCocFacilities([...cocFacilities, { id: uuidv4(), name: trimmedName, created_at: new Date().toISOString() }]);
    setNewCocFacilityName('');
  };

  const updateCocFacility = (id: string, patch: Partial<CocFacility>) => {
    setCocFacilities(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleRemoveCocFacility = (idToRemove: string) => { // NEW FUNCTION
    setCocFacilities(cocFacilities.filter(f => f.id !== idToRemove));
  };
  
  const togglePartnership = (local: LocalAgency, foreign: ForeignAgency, checked: boolean) => {
    const matches = (item: AgencyPartnership) => item.local_agency_id === local.id && item.foreign_agency_id === foreign.id;
    if (!checked) { setAgencyPartnerships(current => current.filter(item => !matches(item))); return; }
    if (agencyPartnerships.some(matches)) return;
    const localCount = agencyPartnerships.filter(item => item.local_agency_id === local.id).length;
    const foreignCount = agencyPartnerships.filter(item => item.foreign_agency_id === foreign.id).length;
    if (localCount >= MAX_AGENCY_PARTNERS || foreignCount >= MAX_AGENCY_PARTNERS) {
      toast.error(localCount >= MAX_AGENCY_PARTNERS
        ? `${local.name} already has ${MAX_AGENCY_PARTNERS} foreign-agency contracts.`
        : `${foreign.name} already has ${MAX_AGENCY_PARTNERS} local-agency contracts.`);
      return;
    }
    setAgencyPartnerships(current => [...current, {
      local_agency_id: local.id,
      foreign_agency_id: foreign.id,
      status: 'active',
      agreement_reference: `DAWM-${uuidv4().slice(0, 8).toUpperCase()}`,
      started_at: new Date().toISOString(),
    }]);
  };

  const handleSave = () => {
    if (!config) {
      toast.error('Application settings could not be loaded.');
      return;
    }
    if (countryOptions.length === 0) {
        toast.error("The country list cannot be empty.");
        return;
    }
    if (cocFacilities.length === 0) {
        toast.error("The COC facility list cannot be empty.");
        return;
    }
    if (integrityScoreThresholds.greenMin <= integrityScoreThresholds.yellowMin) {
      toast.error('The green threshold must be higher than the yellow threshold.');
      return;
    }
    const partnershipError = validatePartnerships(agencyPartnerships, localAgencies, foreignAgencies);
    if (partnershipError) { toast.error(partnershipError); return; }
    // Foreign agencies and Local agencies can be empty, as they are optional for candidates/users
    
    mutation.mutate({ ...config, countryOptions, cocFacilities, foreignAgencies, localAgencies, agencyPartnerships, stageFees, stageFeesInitialized: true, integrityScoreThresholds });
  };

  const handleToggleSeed = (value: boolean) => {
    setDisableSeedToggleState(value);
    try {
      setSeedDisabled(value);
      toast.success(`Automatic reseed ${value ? 'disabled' : 'enabled'}. Reload to apply.`);
    } catch (e) {
      toast.error('Could not update seed toggle.');
    }
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
    <div className="space-y-6">
      <PageHeader title="Superadmin Settings" description="Manage global application configurations: countries, facilities, agencies and fees." />

      <Alert variant="default">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Changes here affect all new candidate creation forms immediately. Existing candidates are unaffected.
        </AlertDescription>
      </Alert>

      <DemoDataCard />
      <MinistrySubmissionSettings />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Country Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manage the countries available in candidate forms. Each country includes its flag and ISO code.
          </p>
          
          <div className="space-y-2">
            <Label>Current Countries (excluding 'Other')</Label>
            <div className="space-y-2">
              {countryOptions.map((country) => (
                <div key={country} className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                  <span className="flex items-center gap-2"><CountryFlag country={country} className="text-xl leading-none" />{country}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveCountry(country)}
                    disabled={mutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="world-country">Add a country</Label>
            <p className="text-xs text-muted-foreground">
              Search the world list; ISO codes distinguish similarly named countries.
            </p>
            <div className="flex gap-2">
              <SearchableCountrySelect
                value={selectedCountryCode}
                onChange={value => setSelectedCountryCode(value ?? '')}
                disabled={mutation.isPending}
                className="sm:w-72"
              />
              <Button onClick={handleAddWorldCountry} type="button" disabled={mutation.isPending || !selectedCountryCode}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Add another country"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCountry();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddCountry} type="button" disabled={mutation.isPending || !newCountry.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>COC Training Facilities</CardTitle> {/* Updated Title */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current COC Facilities</Label> {/* Updated Label */}
            <div className="space-y-2">
              {cocFacilities.map((facility) => (
                <div key={facility.id} className="p-2 border rounded-md bg-gray-50 dark:bg-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{facility.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveCocFacility(facility.id)}
                      disabled={mutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm col-span-2"
                      value={facility.city ?? ''}
                      onChange={(e) => updateCocFacility(facility.id, { city: e.target.value || undefined })}
                    >
                      <option value="">City…</option>
                      {ETHIOPIAN_CITIES.map(c => <option key={c.name} value={c.name}>{c.name} · {c.population ? c.population.toLocaleString() : 'population not reported'}</option>)}
                    </select>
                    <Input type="number" step="any" placeholder="Latitude" value={facility.latitude ?? ''} onChange={(e) => updateCocFacility(facility.id, { latitude: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <Input type="number" step="any" placeholder="Longitude" value={facility.longitude ?? ''} onChange={(e) => updateCocFacility(facility.id, { longitude: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <Input className="col-span-2" placeholder="Google Maps / GPS link (optional)" value={facility.gps_url ?? ''} onChange={(e) => updateCocFacility(facility.id, { gps_url: e.target.value || undefined })} />
                  </div>
                  {facilityMapsUrl(facility) && (
                    <a href={facilityMapsUrl(facility)!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open GPS location</a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Input 
              placeholder="Add new COC facility"
              value={newCocFacilityName}
              onChange={(e) => setNewCocFacilityName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCocFacility();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddCocFacility} type="button" disabled={mutation.isPending || !newCocFacilityName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>ELMIS agency connection pending</AlertTitle>
        <AlertDescription>
          The agency directory is read-only. Existing agencies remain available for candidates, staff and contracts.
          ELMIS agency access requires the official API contract and credentials; no agency data is being fetched or synchronized.
        </AlertDescription>
      </Alert>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Foreign Employment Agencies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Foreign Agencies</Label>
            <div className="space-y-2">
              {foreignAgencies.map((agency) => (
                <div key={agency.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {agency.country_code
                      ? <CountryFlag country={agency.country_code} className="text-xl leading-none" />
                      : <span className="text-xs text-muted-foreground">No country</span>}
                    <span className="truncate">{agency.name}</span>
                  </span>
                  {agency.country_code && <span className="text-sm text-muted-foreground">{agency.country_code}</span>}
                </div>
              ))}
              {!foreignAgencies.length && <p className="text-sm text-muted-foreground">No foreign agencies in the existing directory.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Local Agencies</CardTitle> {/* Updated Title */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Local Agencies</Label> {/* Updated Label */}
            <div className="space-y-2">
              {localAgencies.map((agency) => (
                <div key={agency.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{agency.name}</span>
                </div>
              ))}
              {!localAgencies.length && <p className="text-sm text-muted-foreground">No local agencies in the existing directory.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-5xl">
        <CardHeader>
          <CardTitle>Agency partner contracts</CardTitle>
          <p className="text-sm text-muted-foreground">Each Ethiopian agency can contract with up to 5 foreign agencies. Each foreign agency can contract with up to 5 local agencies. The same agreement appears in both portals.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {localAgencies.map(local => {
            const linked = agencyPartnerships.filter(item => item.local_agency_id === local.id);
            return <section key={local.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-medium">{local.name}</h3><p className="text-xs text-muted-foreground">{linked.length} / {MAX_AGENCY_PARTNERS} partners contracted</p></div><Badge variant="outline">Local agency</Badge></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {foreignAgencies.map(foreign => {
                  const partnership = linked.find(item => item.foreign_agency_id === foreign.id);
                  const foreignCount = agencyPartnerships.filter(item => item.foreign_agency_id === foreign.id).length;
                  const atCapacity = !partnership && (linked.length >= MAX_AGENCY_PARTNERS || foreignCount >= MAX_AGENCY_PARTNERS);
                  return <label key={foreign.id} className={`flex min-w-0 items-start gap-2 rounded-lg border p-3 text-sm ${atCapacity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/40'}`}>
                    <input type="checkbox" checked={!!partnership} disabled={mutation.isPending || atCapacity} onChange={event => togglePartnership(local, foreign, event.target.checked)} aria-label={`${partnership ? 'Unlink' : 'Link'} ${local.name} and ${foreign.name}`} className="mt-1 h-4 w-4 accent-primary" />
                    <span className="min-w-0"><span className="block truncate font-medium">{foreign.name}</span><span className="block truncate text-xs text-muted-foreground">{partnership ? `${partnership.status} · ${partnership.agreement_reference}` : `${foreignCount} / ${MAX_AGENCY_PARTNERS} local partners`}</span></span>
                  </label>;
                })}
              </div>
            </section>;
          })}
          {(!localAgencies.length || !foreignAgencies.length) && <p className="text-sm text-muted-foreground">Existing local and foreign agencies are needed before creating contracts. The ELMIS connection is pending.</p>}
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Candidate Stage Fees</CardTitle>
          <p className="text-sm text-muted-foreground">Set a separate ETB fee for each service. Leave blank when no fee is charged.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ALL_STAGES.map(stage => (
            <div key={stage.id} className="grid grid-cols-[1fr_10rem] items-center gap-3">
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

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Record check score colors</CardTitle>
          <p className="text-sm text-muted-foreground">Choose the lowest scores that show green and yellow. Scores below the yellow starting score show red. These colors do not grant approval.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_8rem] items-center gap-3">
            <Label htmlFor="integrity-green-min" className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />Green from</Label>
            <Input id="integrity-green-min" type="number" min="1" max="100" value={integrityScoreThresholds.greenMin} disabled={mutation.isPending} onChange={event => setIntegrityScoreThresholds(value => ({ ...value, greenMin: Number(event.target.value) }))} />
          </div>
          <div className="grid grid-cols-[1fr_8rem] items-center gap-3">
            <Label htmlFor="integrity-yellow-min" className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" />Yellow from</Label>
            <Input id="integrity-yellow-min" type="number" min="0" max="99" value={integrityScoreThresholds.yellowMin} disabled={mutation.isPending} onChange={event => setIntegrityScoreThresholds(value => ({ ...value, yellowMin: Number(event.target.value) }))} />
          </div>
          <p className="text-xs text-muted-foreground">Red applies below yellow. The score is based on current record warnings.</p>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Development Helpers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Disable automatic reseed</Label>
              <p className="text-sm text-muted-foreground">When enabled, the app will not automatically overwrite local changes on reload.</p>
            </div>
            <div className="flex items-center space-x-4">
              <Switch checked={disableSeedToggle} onCheckedChange={(v) => handleToggleSeed(!!v)} />
            </div>
          </div>
          <div>
            <Button variant="ghost" onClick={() => location.reload()}>
              Reload Now
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <ExternalSystemSimulator />

      <Button 
        onClick={handleSave} 
        disabled={mutation.isPending}
        className="w-full max-w-lg"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save All Settings
      </Button>
    </div>
  );
};

export default SuperadminSettings;