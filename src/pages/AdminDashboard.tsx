import React, { useState } from 'react';
import { usePageMemory } from '@/hooks/use-page-memory';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { CandidateSummary, CandidateSortField, SortDirection } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, PlusCircle, Loader2, Filter, ScanLine } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import NewCandidateForm, { type PassportPrefill } from '@/components/NewCandidateForm/index';
import PassportScanDialog from '@/components/PassportScanDialog';
import CandidateList from '@/components/CandidateList';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { usePresence } from '@/hooks/use-presence';
import ExecutiveDashboard from '@/components/ExecutiveDashboard';
import IntegrityCard from '@/components/IntegrityCard';
import PresenceRoster from '@/components/PresenceRoster';
import FinancialOverview from '@/components/FinancialOverview';
import AgencyPaymentReconciliation from '@/components/AgencyPaymentReconciliation';
import ExpiringContracts from '@/components/ExpiringContracts';
import { PortfolioLifecycle, PortfolioMix, PortfolioWorkforce } from '@/components/PortfolioOverview';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ListChecks, ShieldCheck, Users2, Wallet } from 'lucide-react';
import { RoleCandidateOverview } from '@/components/RoleCandidateOverview';
import CandidateSemanticSearch from '@/components/CandidateSemanticSearch';
import { isSupabaseDataMode } from '@/lib/supabase-sync';
import EditableGrid from '@/components/EditableGrid';
import AgencyPartnerContracts from '@/components/AgencyPartnerContracts';
import FeatureInfo from '@/components/FeatureInfo';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import ControlRoomTabs from '@/components/ControlRoomTabs';
import { candidateListStatus, isCandidateListStatus, type CandidateListStatus } from '@/lib/candidate-list-status';
import { getCandidateStages } from '@/lib/data-store';
import { toast } from 'sonner';
import CandidateStatusSummary from '@/components/CandidateStatusSummary';
import LocalPaymentEvidence from '@/components/LocalPaymentEvidence';
import ControlRoomHeader from '@/components/ControlRoomHeader';
import AgencyResolutionCenter from '@/components/AgencyResolutionCenter';

const ALL_BATCHES_FILTER = 'ALL_BATCHES_FILTER';
const ALL_AGENCIES_FILTER = 'ALL_AGENCIES_FILTER';
const ALL_STATUS_FILTER = 'ALL_STATUS_FILTER';

const DashSection: React.FC<{ title: string; subtitle: string; icon: LucideIcon }> = ({ title, subtitle, icon: Icon }) => (
  <div className="flex items-center gap-3 border-b pb-3 pt-4">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
    <div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold leading-tight">{title}</h2><FeatureInfo title={title} description={subtitle} /></div><p className="text-xs text-muted-foreground">{subtitle}</p></div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const { userRole, userLocalAgencyName, userLocalAgencyId, user, viewAs } = useAuth();
  const staffId = viewAs ? viewAs.userId : user?.id;
  const isSuperAdmin = userRole === 'superadmin';
  const isLocalAgency = userRole === 'local-agency';
  
  const [searchQuery, setSearchQuery] = usePageMemory('search', '');
  const [currentQuery, setCurrentQuery] = usePageMemory('query', '');
  const [listStatus, setListStatus] = usePageMemory<CandidateListStatus | null>('status', null);
  const [filterBatch, setFilterBatch] = usePageMemory('batch', ALL_BATCHES_FILTER);
  const [filterForeignAgencyId, setFilterForeignAgencyId] = usePageMemory('foreign', ALL_AGENCIES_FILTER);
  const [filterLocalAgencyId, setFilterLocalAgencyId] = usePageMemory('local', ALL_AGENCIES_FILTER);
  const [visualLocalAgencyId, setVisualLocalAgencyId] = usePageMemory('visual-local', ALL_AGENCIES_FILTER);
  const [activeSection, setActiveSection] = usePageMemory('section', 'overview');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [prefill, setPrefill] = useState<PassportPrefill | null>(null);
  
  // Sorting state
  const [sortBy, setSortBy] = usePageMemory<CandidateSortField>('sort', 'tracking_code');
  const [sortDirection, setSortDirection] = usePageMemory<SortDirection>('direction', 'asc');

  const effectiveFilterBatch = filterBatch === ALL_BATCHES_FILTER ? undefined : filterBatch;
  const { data: foreignAgencies = [] } = useQuery({ queryKey: ['dashboardForeignAgencies'], queryFn: api.getForeignAgencyList, enabled: isSuperAdmin });
  const { data: localAgencies = [] } = useQuery({ queryKey: ['dashboardLocalAgencies'], queryFn: api.getLocalAgencyList, enabled: isSuperAdmin });
  const effectiveForeignAgencyFilter = isSuperAdmin
    ? foreignAgencies.find(agency => agency.id === filterForeignAgencyId)?.name
    : undefined;
  const effectiveLocalAgencyFilter = isLocalAgency
    ? userLocalAgencyName ?? undefined
    : isSuperAdmin ? localAgencies.find(agency => agency.id === filterLocalAgencyId)?.name : undefined;

  const { data: candidates, isLoading, refetch } = useQuery<CandidateSummary[]>({
    queryKey: ['adminCandidates', currentQuery, effectiveFilterBatch, effectiveForeignAgencyFilter, effectiveLocalAgencyFilter, sortBy, sortDirection, isLocalAgency ? userLocalAgencyId : undefined],
    queryFn: async () => (await api.searchCandidates(
      currentQuery, 
      undefined,
      effectiveFilterBatch,
      sortBy,
      sortDirection,
      'All',
      effectiveForeignAgencyFilter,
      effectiveLocalAgencyFilter // Filter by the logged-in Local Agency Name
    )).filter(candidate => !isLocalAgency || candidate.local_agency_id === userLocalAgencyId),
    initialData: [],
  });
  const listCandidates = candidates.filter(candidate => !listStatus || candidateListStatus(candidate) === listStatus);
  
  const { data: activeBatches = [], isLoading: isLoadingBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staffUsers'],
    queryFn: api.getAllStaffUsers,
  });
  const { data: rosterCandidates = [] } = useQuery({
    queryKey: ['presenceCandidates', isLocalAgency ? userLocalAgencyId : undefined],
    queryFn: async () => (await api.searchCandidates('')).filter(candidate => !isLocalAgency || candidate.local_agency_id === userLocalAgencyId),
  });

  const presence = usePresence();

  const { data: assigned = [], isLoading: assignedLoading, isError: assignedError } = useQuery({
    queryKey: ['staffAssignedOverview', staffId],
    queryFn: async () => {
      const stageCandidates = new Set(getCandidateStages().filter(stage => stage.assigned_staff_id === staffId).map(stage => stage.candidate_id));
      return (await api.searchCandidates('')).filter(candidate => candidate.assigned_staff_id === staffId || stageCandidates.has(candidate.id));
    },
    enabled: userRole === 'staff' && !!staffId,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentQuery(searchQuery);
  };
  
  const handleCandidateCreated = () => {
      refetch();
  };
  
  const handleStatusSelect = (status: string) => {
    if (status === ALL_STATUS_FILTER) setListStatus(null);
    else if (isCandidateListStatus(status)) setListStatus(status);
    else toast.error('Choose a valid candidate status.');
  };
  
  const handleBatchSelect = (batch: string) => {
    setFilterBatch(batch);
    setCurrentQuery(''); 
    setSearchQuery('');
  };

  const selectedLocalAgencyName = localAgencies.find(agency => agency.id === visualLocalAgencyId)?.name;
  const visualLocalId = isLocalAgency ? userLocalAgencyId ?? undefined : visualLocalAgencyId === ALL_AGENCIES_FILTER ? undefined : visualLocalAgencyId;
  
  const handleSort = (field: CandidateSortField) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-5">
      <ControlRoomHeader
        scope={isLocalAgency ? `${userLocalAgencyName ?? 'Local agency'} · operations` : isSuperAdmin ? 'Super admin · workforce operations' : userRole === 'admin' ? 'Administrator · workforce operations' : 'Staff · workforce operations'}
        description={isLocalAgency ? 'Candidate movement, agency finance, and operational risk for your agency.' : 'Candidate movement, agency finance, and operational risk across the workforce.'}
        icon={LayoutDashboard}
        actions={(
          <>
            <Button variant="outline" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10" onClick={() => setIsScanOpen(true)}>
              <ScanLine className="mr-2 h-4 w-4" /> Upload via passport
            </Button>
            <FeatureInfo title="Passport upload" className="text-white/80 hover:bg-white/10" />
            <PassportScanDialog
              open={isScanOpen}
              onOpenChange={setIsScanOpen}
              onConfirm={scan => {
                setPrefill({ ...scan.data, passport_image_url: scan.imageUrl, passport_image_scan_report: scan.screeningReport });
                setIsScanOpen(false);
                setIsDialogOpen(true);
              }}
            />
            <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) setPrefill(null); }}>
              <DialogTrigger asChild>
                <Button data-tour="registration"><PlusCircle className="mr-2 h-4 w-4" />Add New Candidate</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader><DialogTitle>Create New Candidate Record</DialogTitle></DialogHeader>
                <NewCandidateForm onSuccess={handleCandidateCreated} onClose={() => setIsDialogOpen(false)} prefill={prefill} />
              </DialogContent>
            </Dialog>
            <FeatureInfo title="Add new candidate" className="text-white/80 hover:bg-white/10" />
          </>
        )}
      />

      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-5">
        <ControlRoomTabs />

        <TabsContent value="overview" className="space-y-6">
      <DashSection title="Command overview" subtitle="Movement, risk, and live workload" icon={LayoutDashboard} />
      <EditableGrid pageId="dash-overview" title="Overview" items={[
      { id: 'view', title: 'Dashboard view', node: isSuperAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
          <span className="text-sm font-medium">Dashboard view</span>
          <Select value={visualLocalAgencyId} onValueChange={setVisualLocalAgencyId}>
            <SelectTrigger aria-label="Filter dashboard by local agency" className="w-64"><SelectValue placeholder="Local agency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AGENCIES_FILTER}>All local agencies</SelectItem>
              {localAgencies.map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Applies to the totals and charts below. The integrity score stays system-wide.</span>
        </div>
      ) },
      { id: 'integrity', title: 'Integrity score', node: !isLocalAgency && <IntegrityCard /> },
      { id: 'resolution', title: 'Resolve & protect', node: isSuperAdmin && <AgencyResolutionCenter /> },
      { id: 'assigned', title: 'Assigned candidates', node: userRole === 'staff' && <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Your assigned candidates</h2>
          <p className="text-sm text-muted-foreground">Your workload; the full pipeline remains available below.</p></div>
        {!staffId ? <p className="text-sm text-muted-foreground">Select a specific staff user in View As to see their workload.</p>
          : assignedError ? <p role="alert" className="text-destructive">Could not load assigned candidate totals.</p>
          : assignedLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <RoleCandidateOverview candidates={assigned} active={listStatus} onSelect={setListStatus} />}
      </section>},
      { id: 'executive', title: 'Executive overview', node: <ExecutiveDashboard
        localAgencyName={isLocalAgency ? userLocalAgencyName ?? undefined : selectedLocalAgencyName}
        localAgencyId={visualLocalId}
        candidateBasePath={isLocalAgency ? '/local-agency/candidate' : '/admin/candidate'}
      /> },
      { id: 'presence', title: 'Live roster', node: <PresenceRoster
        snapshot={presence}
        scope={isLocalAgency ? 'local' : 'admin'}
        staff={staffUsers}
        candidates={rosterCandidates}
        localAgencyId={userLocalAgencyId}
        candidateBasePath={isLocalAgency ? '/local-agency/candidate' : '/admin/candidate'}
      /> },
      ]} />
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-6">
      <DashSection title="Candidate portfolio" subtitle="Who is where in the journey, and who is already working" icon={Users2} />
      <EditableGrid pageId="dash-portfolio" title="Candidate portfolio" items={[
      { id: 'lifecycle', title: 'Candidate lifecycle', span: 6, node: <PortfolioLifecycle localAgencyId={visualLocalId} /> },
      { id: 'workforce', title: 'Working abroad', span: 6, node: <PortfolioWorkforce localAgencyId={visualLocalId} /> },
      { id: 'mix', title: 'Portfolio mix', node: <PortfolioMix localAgencyId={visualLocalId} /> },
      { id: 'partners', title: 'Partner contracts', node: isLocalAgency && <AgencyPartnerContracts /> },
      ]} />
        </TabsContent>

        <TabsContent value="finance" className="space-y-6">
      <DashSection title="Finance" subtitle="Collections, receipts and agency settlement checks" icon={Wallet} />
      <Button asChild variant="outline"><Link to={isLocalAgency ? '/local-agency/payments' : '/admin/payments?tab=discrepancies&source=candidate'}><Wallet className="mr-2 h-4 w-4" />View receipts and bank statements side by side</Link></Button>
      <EditableGrid pageId="dash-finance" title="Finance" items={[
      { id: 'finance', title: 'Financial overview', node: <FinancialOverview localAgencyId={visualLocalId} /> },
      ]} />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
      <DashSection title="Contracts and compliance" subtitle="Expiring work contracts and record integrity" icon={ShieldCheck} />
      <EditableGrid pageId="dash-compliance" title="Contracts and compliance" items={[
      { id: 'foreign-payment-compliance', title: 'Foreign to local payment compliance', node: <AgencyPaymentReconciliation localAgencyId={visualLocalId} /> },
      { id: 'local-payment-evidence', title: 'Candidate to local payment evidence', node: <LocalPaymentEvidence key={visualLocalId || 'all'} localAgencyId={visualLocalId} /> },
      { id: 'expiring', title: 'Contracts ending soon', node: <ExpiringContracts localAgencyId={visualLocalId} /> },
      ]} />
        </TabsContent>

        <TabsContent value="candidates" className="space-y-6">
      <DashSection title="Candidates" subtitle="Search, filter and open any candidate" icon={ListChecks} />
      <EditableGrid pageId="dash-candidates" title="Candidates" items={[
      { id: 'search', title: 'Semantic search', node: isSupabaseDataMode() && <CandidateSemanticSearch /> },
      { id: 'filters', title: 'Search and filters', node: (
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, passport or tracking code"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </form>
        <div className="w-full md:w-56">
          <Select value={filterBatch} onValueChange={handleBatchSelect} disabled={isLoadingBatches}>
            <SelectTrigger>
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BATCHES_FILTER}>All batches</SelectItem>
              {activeBatches.map(batch => <SelectItem key={batch} value={batch}>{batch}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-52">
          <Select value={listStatus || ALL_STATUS_FILTER} onValueChange={handleStatusSelect}>
            <SelectTrigger aria-label="Filter by candidate status">
              <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_FILTER}>All statuses</SelectItem>
              <SelectItem value="inProgress">In progress</SelectItem>
              <SelectItem value="pendingQr">Pending ministry QR</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isSuperAdmin && (
          <div className="grid w-full gap-2 sm:grid-cols-2 md:w-auto">
            <Select value={filterForeignAgencyId} onValueChange={setFilterForeignAgencyId}>
              <SelectTrigger aria-label="Filter by foreign agency"><SelectValue placeholder="Foreign agency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_AGENCIES_FILTER}>All foreign agencies</SelectItem>
                {foreignAgencies.map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLocalAgencyId} onValueChange={setFilterLocalAgencyId}>
              <SelectTrigger aria-label="Filter by local agency"><SelectValue placeholder="Local agency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_AGENCIES_FILTER}>All local agencies</SelectItem>
                {localAgencies.map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      ) },
      { id: 'candidates', title: 'Candidates list', node: (
      <div className="space-y-4">
      <CandidateStatusSummary candidates={candidates} active={listStatus} onSelect={setListStatus} />
      {listStatus && <Button size="sm" variant="ghost" onClick={() => setListStatus(null)}>Clear status summary filter · showing {listCandidates.length}</Button>}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {listCandidates.length} candidate{listCandidates.length === 1 ? '' : 's'}
            {listStatus && <Badge variant="secondary" className="ml-2">{({ inProgress: 'In progress', pendingQr: 'Pending ministry QR', completed: 'Completed', failed: 'Failed' })[listStatus]}</Badge>}
            {effectiveFilterBatch && <Badge variant="secondary" className="ml-2">{effectiveFilterBatch}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : listCandidates.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No candidates found matching your criteria.</p>
          ) : (
            <CandidateList
              candidates={listCandidates}
              basePath={isLocalAgency ? '/local-agency/candidate' : '/admin/candidate'}
              sortBy={sortBy}
              direction={sortDirection}
              presence={presence}
              onSort={handleSort}
            />
          )}
        </CardContent>
      </Card>
      </div>
      ) },
      ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
