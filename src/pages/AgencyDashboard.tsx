import React, { useState } from 'react';
import { usePageMemory } from '@/hooks/use-page-memory';
import CandidateRowActions from '@/components/CandidateRowActions';
import { useCandidateGuidance } from '@/hooks/use-candidate-guidance';
import { candidateListStatus, isCandidateListStatus, summarizeCandidateListStatuses, type CandidateListStatus } from '@/lib/candidate-list-status';
import { useAuth } from '@/lib/auth-context';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { contractWasSent, foreignContractPayment } from '@/lib/foreign-contract-payment';
import { Loader2 } from 'lucide-react';
import { contractCountryOf, currencyForCountry, minimumPerCandidate } from '@/lib/currency';
import { Building, Search, Filter, ArrowUp, ArrowDown, CheckCircle, DollarSign, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/index';
import type { CandidateSummary, CandidateSortField, SortDirection, ForeignAgency, LocalAgency, CandidateDetail, StaffUser } from '@/lib/types';
import { ALL_STAGES } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '../components/ui/badge';
import ProgressIndicator from '@/components/ProgressIndicator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import CountryFlag from '@/components/CountryFlag';
import { RoleCandidateOverview } from '@/components/RoleCandidateOverview';
import AgencyPartnerContracts from '@/components/AgencyPartnerContracts';
import PresenceRoster from '@/components/PresenceRoster';
import { usePresence } from '@/hooks/use-presence';
import { normalizePartnerships } from '@/lib/agency-partnerships';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { Candidate } from '@/lib/types';
import { getApprovalLogs, getCandidateStages, getConfig, getDocuments, getIntegrityOverrides, getMedicalResults, getPaymentStatuses, getPayments } from '@/lib/data-store';
import { analyzeIntegrity, applyOverrides } from '@/lib/integrity';
import CandidateIntroductionMedia from '@/components/CandidateIntroductionMedia';
import WorkContractHandoff from '@/components/WorkContractHandoff';
import EmploymentJourneyHistory from '@/components/EmploymentJourneyHistory';
import CandidateAvatar from '@/components/CandidateAvatar';
import ControlRoomHeader from '@/components/ControlRoomHeader';
import CandidateStaffingBoard from '@/components/CandidateStaffingBoard';
import { filterStaffingCandidates, type StaffingFilters } from '@/lib/candidate-staffing';
import { getForeignStaffWork } from '@/lib/api/foreign-staff-work';

const statusColors: Record<CandidateSummary['overall_status'], string> = {
  'Completed': 'bg-green-500 hover:bg-green-600 text-white',
  'In Progress': 'bg-blue-500 hover:bg-blue-600 text-white',
  'Blocked': 'bg-red-500 hover:bg-red-600 text-white',
  'Pending': 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

const RELEVANT_AGENCY_STAGES = ['registration', 'training', 'medical', 'deployment'];
const DONE_STAGE_STATUSES = new Set(['Passed', 'Issued', 'Completed']);

const AgencyInsights: React.FC<{
  candidates: CandidateSummary[];
  onSelectStatus: (status: CandidateListStatus) => void;
}> = ({ candidates, onSelectStatus }) => {
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const stages = getCandidateStages().filter(stage => candidateIds.has(stage.candidate_id));
  const findings = analyzeIntegrity({
    candidates: candidates as Candidate[],
    stages,
    documents: getDocuments().filter(document => candidateIds.has(document.candidate_id)),
    payments: getPayments().filter(payment => payment.candidate_ids.some(id => candidateIds.has(id))),
    paymentStatuses: getPaymentStatuses().filter(status => candidateIds.has(status.candidateId)),
    medicals: getMedicalResults().filter(result => candidateIds.has(result.candidate_id)),
    logs: getApprovalLogs().filter(log => log.target_type === 'Candidate' && candidateIds.has(log.target_id)),
    stageFees: getConfig().stageFees,
  });
  const activeFindings = applyOverrides(findings, getIntegrityOverrides()).active;
  const byCandidate = new Map<string, typeof activeFindings>();
  activeFindings.forEach(finding => {
    if (finding.candidateId) byCandidate.set(finding.candidateId, [...(byCandidate.get(finding.candidateId) ?? []), finding]);
  });
  const weight = { critical: 0, high: 1, medium: 2, low: 3 };
  const attention = candidates.map(candidate => {
    const reasons = (byCandidate.get(candidate.id) ?? []).sort((a, b) => weight[a.severity] - weight[b.severity]);
    const stale = candidate.overall_status === 'In Progress'
      && Date.now() - new Date(candidate.updated_at).getTime() > 45 * 86_400_000;
    if (!reasons.length && candidate.overall_status !== 'Blocked' && !stale) return null;
    return {
      candidate,
      reason: reasons[0]?.title ?? (candidate.overall_status === 'Blocked' ? 'Workflow blocked' : 'No recent progress'),
      severity: reasons[0]?.severity ?? (candidate.overall_status === 'Blocked' ? 'high' : 'medium'),
    };
  }).filter((item): item is NonNullable<typeof item> => !!item)
    .sort((a, b) => weight[a.severity as keyof typeof weight] - weight[b.severity as keyof typeof weight]);

  const stageRows = ALL_STAGES.map(stage => {
    const records = stages.filter(record => record.stage_id === stage.id);
    return {
      stage: stage.title,
      completed: records.filter(record => DONE_STAGE_STATUSES.has(record.status)).length,
      inProgress: records.filter(record => record.status === 'In Progress').length,
      blocked: records.filter(record => record.status === 'Failed').length,
      waiting: records.filter(record => record.status === 'Pending').length,
    };
  });
  const counts = summarizeCandidateListStatuses(candidates);
  const statuses = [
    { label: 'In progress', filter: 'inProgress' as const, value: counts.inProgress, color: 'bg-blue-500' },
    { label: 'Failed', filter: 'failed' as const, value: counts.failed, color: 'bg-rose-500' },
    { label: 'Completed', filter: 'completed' as const, value: counts.completed, color: 'bg-emerald-500' },
    { label: 'Pending ministry QR', filter: 'pendingQr' as const, value: counts.pendingQr, color: 'bg-amber-500' },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline progression</CardTitle>
          <p className="text-sm text-muted-foreground">Compare completed, active, blocked, and waiting candidates at each stage.</p>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageRows} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} fontSize={11} />
                <YAxis type="category" dataKey="stage" width={112} axisLine={false} tickLine={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" stackId="progress" fill="#10b981" />
                <Bar dataKey="inProgress" name="In progress" stackId="progress" fill="#2563eb" />
                <Bar dataKey="blocked" name="Blocked" stackId="progress" fill="#f43f5e" />
                <Bar dataKey="waiting" name="Waiting" stackId="progress" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {statuses.map(status => <button key={status.label} type="button" onClick={() => onSelectStatus(status.filter)} className="inline-flex items-center gap-1.5 hover:text-foreground"><span className={`h-2 w-2 rounded-full ${status.color}`} />{status.label}: {status.value}</button>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div><CardTitle className="text-base">Needs attention</CardTitle><p className="text-sm text-muted-foreground">Blocked, flagged, or inactive candidate files.</p></div>
          <Badge variant={attention.length ? 'destructive' : 'outline'}>{attention.length}</Badge>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No active blockers or high-priority flags.</p> : (
            <ul className="divide-y">
              {attention.slice(0, 6).map(item => (
                <li key={item.candidate.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-start gap-2">
                    <CandidateAvatar candidate={item.candidate} className="h-9 w-9" />
                    <div className="min-w-0">
                      <Link to={`/public-track/${item.candidate.tracking_code}`} className="font-medium hover:text-primary hover:underline">{item.candidate.first_name} {item.candidate.last_name}</Link>
                      <p className="font-mono text-xs text-muted-foreground">{item.candidate.tracking_code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  </div>
                  <Badge variant={item.severity === 'critical' || item.severity === 'high' ? 'destructive' : 'outline'} className="shrink-0 capitalize">{item.severity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface SortableHeaderProps {
  field: CandidateSortField;
  currentSort: CandidateSortField;
  currentDirection: SortDirection;
  label: string;
  onSort: (field: CandidateSortField) => void;
  className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ field, currentSort, currentDirection, label, onSort, className }) => {
  const isCurrent = currentSort === field;
  const Icon = isCurrent ? (currentDirection === 'asc' ? ArrowUp : ArrowDown) : null;

  return (
    <TableHead 
      className={cn("cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors", className)}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {Icon && <Icon className="h-3 w-3" />}
      </div>
    </TableHead>
  );
};

const AgencyDashboard: React.FC = () => {
  const { userRole, user, isDemo, isLoading: isAuthLoading, userForeignAgencyName, userForeignAgencyId, viewAs } = useAuth(); // Renamed
  const queryClient = useQueryClient();
  const { data: workload } = useQuery({
    queryKey: ['foreign-staff-work', viewAs?.userId ?? user?.id, userRole, userForeignAgencyId],
    queryFn: getForeignStaffWork,
    enabled: !!userForeignAgencyId,
    refetchInterval: 30000,
  });
  
  const [searchQuery, setSearchQuery] = usePageMemory('search', '');
  const [currentQuery, setCurrentQuery] = usePageMemory('query', '');
  const [listStatus, setListStatus] = usePageMemory<CandidateListStatus | null>('status', null);
  const [staffingFilters, setStaffingFilters] = usePageMemory<StaffingFilters>('staffing', { workType: '', language: '' });
  // Explicit type annotation
  // let filterStatus: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' | 'All';
  
  // Sorting state
  const [sortBy, setSortBy] = usePageMemory<CandidateSortField>('sort', 'tracking_code');
  const [sortDirection, setSortDirection] = usePageMemory<SortDirection>('direction', 'asc');

  // Payment related states
  const [selectedCandidatesForPayment, setSelectedCandidatesForPayment] = useState<CandidateSummary[]>([]);
  const [paymentParams, setPaymentParams] = useSearchParams();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState<boolean>(false);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<CandidateDetail | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [paymentProcessingMessage, setPaymentProcessingMessage] = useState<string>('');
  const [isSliderOpen, setIsSliderOpen] = useState<boolean>(false);
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const [sliderPaymentMessage, setSliderPaymentMessage] = useState<string>('');

  const { data: overviewCandidates = [], isLoading: overviewLoading, isError: overviewError } = useQuery({
    queryKey: ['foreignOverviewCandidates', userForeignAgencyId],
    queryFn: async () => (await api.searchCandidates('')).filter(c => c.foreign_agency_id === userForeignAgencyId || c.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)),
    enabled: !!userForeignAgencyId,
  });
  React.useEffect(() => {
    const candidateId = paymentParams.get('payCandidate');
    if (!candidateId || !overviewCandidates.length) return;
    const candidate = overviewCandidates.find(candidate => candidate.id === candidateId && candidate.foreign_agency_id === userForeignAgencyId);
    if (!candidate || !['agency', 'foreign-agency'].includes(userRole ?? '')) {
      toast.error('Choose a candidate assigned to your foreign agency.');
    } else {
      setSelectedCandidatesForPayment([candidate]);
      setIsPaymentDialogOpen(true);
    }
    const next = new URLSearchParams(paymentParams);
    next.delete('payCandidate');
    setPaymentParams(next, { replace: true });
  }, [paymentParams, overviewCandidates, userForeignAgencyId, userRole, setPaymentParams]);

  const { data: fetchedCandidates = [], isLoading, refetch } = useQuery({
    queryKey: ['agencyCandidates', currentQuery, userForeignAgencyId, sortBy, sortDirection],
    queryFn: async () => (await api.searchCandidates(
      currentQuery, 
      undefined,
      undefined, // No batch filter for agency dashboard
      sortBy,
      sortDirection,
      'All', // No time filter for agency dashboard
      undefined,
      undefined // No local agency filter here
    )).filter(c => c.foreign_agency_id === userForeignAgencyId || c.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)),
    enabled: !!userForeignAgencyId,
    initialData: [],
  });
  const candidates = filterStaffingCandidates(fetchedCandidates, staffingFilters).filter(candidate => !listStatus || candidateListStatus(candidate) === listStatus);
  const guidance = useCandidateGuidance(candidates);

  const { data: localAgencies = [] } = useQuery<LocalAgency[]>({
    queryKey: ['localAgencies'],
    queryFn: api.getLocalAgencyList,
    initialData: [],
  });

  const { data: config } = useQuery({ queryKey: ['agency-partnership-config'], queryFn: api.getAppConfig });

  const { data: allStaff = [] } = useQuery<StaffUser[]>({
    queryKey: ['staffUsers'],
    queryFn: api.getAllStaffUsers,
    initialData: [],
  });
  const presence = usePresence();

  const { data: recentPayments = [] } = useQuery({
    queryKey: ['recentPayments', userForeignAgencyId],
    queryFn: () => api.getPaymentsByForeignAgency(userForeignAgencyId!),
    enabled: !!userForeignAgencyId,
    initialData: [],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentQuery(searchQuery);
  };
  
  const handleStatusSelect = (status: string) => {
    if (status === 'All') setListStatus(null);
    else if (isCandidateListStatus(status)) setListStatus(status);
    else toast.error('Choose a valid candidate status.');
  };
  
  const handleSort = (field: CandidateSortField) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const handleCandidateSelection = (candidate: CandidateSummary, isChecked: boolean) => {
    setSelectedCandidatesForPayment(prev => {
      if (isChecked) {
        // When selecting, ensure all selected candidates belong to the same local agency
        if (prev.length > 0 && prev[0].local_agency_id !== candidate.local_agency_id) {
          toast.error("All selected candidates must belong to the same Local Agency for a single payment.");
          return prev;
        }
        return [...prev, candidate];
      } else {
        return prev.filter(c => c.id !== candidate.id);
      }
    });
  };

  const handleInitiatePayment = async () => {
    if (!isDemo) {
      toast.error('Foreign-agency settlement is not connected to a live provider yet. No payment was started.');
      return;
    }
    if (selectedCandidatesForPayment.length === 0) {
      toast.error('No candidates selected for payment.');
      return;
    }

      if (!userForeignAgencyId) {
      toast.error('Foreign agency name is missing. Please contact support.');
      return;
    }

    try {
      setIsPaymentDialogOpen(true);
      const { checkoutUrl } = await api.initiatePayment(
        userForeignAgencyId,
        selectedCandidatesForPayment.map(c => c.id),
        user?.id || '',
        user?.email || ''
      );
      window.open(checkoutUrl, '_blank');
      toast.success('Payment initiated successfully.');
    } catch (error) {
      console.error('Payment initiation failed:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsPaymentDialogOpen(false);
    }
  };

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!isDemo) throw new Error('Foreign-agency settlement is not connected to a live provider yet.');
      if (!user?.id || !user?.email || !userForeignAgencyName) {
        throw new Error("User or foreign agency information missing.");
      }
      const faList = await api.getForeignAgencyList();
      const payerForeignAgency = faList.find(fa => fa.name === userForeignAgencyName);
      if (!payerForeignAgency) {
        throw new Error("Foreign agency not found in system.");
      }

      const candidateIds = selectedCandidatesForPayment.map(c => c.id);
      setPaymentProcessingMessage("Initiating payment with gateway...");
      const { checkoutUrl, paymentId } = await api.initiatePayment(
        payerForeignAgency.id,
        candidateIds,
        user?.id ?? '',
        user?.email ?? '',
        requiredPayment?.currency
      );

      // Simulate redirect to checkout and then webhook callback
      setPaymentProcessingMessage("Redirecting to payment gateway (placeholder)...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate redirect time

      // Placeholder webhook success/failure
      const paymentSuccess = Math.random() > 0.1; // 90% success rate
      setPaymentProcessingMessage(`Payment gateway responded: ${paymentSuccess ? 'Success' : 'Failure'}. Processing...`);
      await api.processPaymentWebhook(paymentId, paymentSuccess ? 'succeeded' : 'failed');
      
      return paymentSuccess;
    },
    onSuccess: (paymentSuccess) => {
      if (paymentSuccess) {
        toast.success("Payment processed successfully! Candidate statuses updated.");
      } else {
        toast.error("Payment failed. Please try again.");
      }
      setSelectedCandidatesForPayment([]);
      setIsPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agencyCandidates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['paymentAnalytics'] });
      refetch(); // Refetch candidates to update their payment status
    },
    onError: (error) => {
      toast.error(`Payment initiation failed: ${(error as Error).message}`);
      setIsPaymentDialogOpen(false);
    },
  });

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if ((userRole !== 'agency' && userRole !== 'foreign-agency' && userRole !== 'foreign-agency-staff') || !userForeignAgencyName) {
    return <Navigate to="/login" replace />;
  }
  
  const agencyName = userForeignAgencyName; // Use the actual foreign agency name

  const contractCountries = Array.from(new Set(selectedCandidatesForPayment.map(c => contractCountryOf(c))));
  const contractCountry = contractCountries.length === 1 ? contractCountries[0] : undefined;
  const requiredPayment = minimumPerCandidate(contractCountry);
  const totalPaymentAmount = requiredPayment ? Math.round(selectedCandidatesForPayment.length * requiredPayment.amount * 100) / 100 : 0;
  const paymentBlocker = selectedCandidatesForPayment.length === 0 ? null
    : contractCountries.length > 1 ? 'Selected candidates have different work contract countries. Pay for one country at a time.'
    : !requiredPayment ? 'Set the work contract destination country on the candidate before paying.' : null;

  return (
    <div className="space-y-6">
      <ControlRoomHeader
        scope={`Foreign agency · ${agencyName}`}
        description="Review candidate progress, agency payments, introductions and what is needed before departure."
        icon={Building}
      />
      {userForeignAgencyId && <Link to="/agency/tasks" className="block rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-background p-5 transition-colors hover:border-primary/50">
        <div className="flex items-center justify-between gap-4"><div><p className="font-semibold">{userRole === 'foreign-agency-staff' ? 'My work' : 'Staff workload'}</p><p className="text-sm text-muted-foreground">{workload ? `${workload.tasks.length} current tasks · ${workload.tasks.filter(task => task.action === 'Awaiting payment').length} awaiting payment` : 'Open your agency workboard'}</p></div><span className="text-sm font-medium text-primary">Open workboard →</span></div>
      </Link>}
      <div data-tour="agency-pipeline" className="space-y-6">
          {!userForeignAgencyId ? <p role="alert" className="text-destructive">No foreign agency is assigned to this account.</p>
            : overviewError ? <p role="alert" className="text-destructive">Could not load candidate totals.</p>
              : overviewLoading ? <Loader2 className="h-6 w-6 animate-spin" />
                : <RoleCandidateOverview candidates={overviewCandidates} active={listStatus} onSelect={setListStatus} />}
          {userForeignAgencyId && !overviewLoading && !overviewError && <AgencyInsights candidates={overviewCandidates} onSelectStatus={handleStatusSelect} />}
          <PresenceRoster
            snapshot={presence}
            scope="foreign"
            staff={allStaff}
            candidates={overviewCandidates}
            localAgencies={config?.localAgencies ?? localAgencies}
            foreignAgencies={config?.foreignAgencies ?? []}
            partnerships={normalizePartnerships(config?.agencyPartnerships, overviewCandidates)}
            foreignAgencyId={userForeignAgencyId}
          />
          <AgencyPartnerContracts />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              {/* main staged candidates card (kept below) */}
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent payments.</p>
                  ) : (
                    <ul className="text-sm space-y-2">
                      {recentPayments.slice(0,5).map(p => (
                        <li key={p.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{p.amount} {p.currency}</div>
                            <div className="text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <a href={`/mock-payment-checkout?paymentId=${p.id}&amount=${p.amount}&currency=${p.currency}`} target="_blank" rel="noreferrer" className="underline text-sm">View</a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 text-right">
                    <Button asChild>
                      <a href="/agency/payments">View all</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {userForeignAgencyId && <CandidateStaffingBoard key={userForeignAgencyId} agencyId={userForeignAgencyId} candidates={candidates} scopeCandidates={overviewCandidates} filters={staffingFilters} onFiltersChange={setStaffingFilters} onOpen={async candidate => {
            try {
              const detail = await api.getCandidateDetail(candidate.id);
              if (!detail) throw new Error('Candidate details were not found.');
              setSelectedCandidateDetail(detail); setIsViewerOpen(true);
            } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not open candidate profile.'); }
          }} />}
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Candidate progress ({candidates.length})
                <div className="flex items-center space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => { setIsSliderOpen(true); setSliderIndex(0); }}>
                      <User className="h-4 w-4 mr-2" /> Open Slider
                    </Button>
                  <Button 
                    onClick={handleInitiatePayment} 
                    disabled={!isDemo || selectedCandidatesForPayment.length === 0 || paymentMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {paymentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                    {isDemo ? `Dispense & Pay · demo (${selectedCandidatesForPayment.length})` : 'Live settlement unavailable'}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <form onSubmit={handleSearch} className="flex space-x-2 flex-grow">
                  <Input
                    placeholder="Search by Name, Passport, or Tracking Code"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow"
                  />
                  <Button type="submit">
                    <Search className="h-4 w-4 mr-2" /> Search
                  </Button>
                </form>
                
                <div className="w-full md:w-60">
                  <Select
                    value={listStatus ?? 'All'}
                    onValueChange={handleStatusSelect}
                  >
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="inProgress">In progress</SelectItem>
                      <SelectItem value="pendingQr">Pending ministry QR</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-center text-muted-foreground p-8">No candidates found matching your criteria or agency.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          {/* Select All Checkbox (Optional, for simplicity not implemented here) */}
                        </TableHead>
                        <SortableHeader 
                          field="first_name" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Name" 
                          onSort={handleSort} 
                        />
                        <SortableHeader 
                          field="tracking_code" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Tracking Code" 
                          onSort={handleSort} 
                        />
                        <TableHead>Progress</TableHead>
                        <TableHead>Profile / passport / record checks</TableHead>
                        <TableHead>Local Agency</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <SortableHeader 
                          field="overall_status" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Overall Status" 
                          onSort={handleSort} 
                        />
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((candidate) => {
                        const isSelected = selectedCandidatesForPayment.some(c => c.id === candidate.id);
                        const localAgency = localAgencies.find(la => la.id === candidate.local_agency_id);
                        
                        // Only allow selection of candidates that are 'In Progress' and 'unpaid'
                        const isSelectable = contractWasSent(candidate) && !foreignContractPayment(candidate, getPayments()).paid;

                        return (
                          <TableRow key={candidate.id} className={cn(isSelected && "bg-blue-50/50 dark:bg-blue-950/50")}>
                            <TableCell>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(checked) => handleCandidateSelection(candidate, checked as boolean)}
                                disabled={!isSelectable || paymentMutation.isPending}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <CandidateAvatar candidate={candidate} className="h-9 w-9" />
                                <button
                                  onClick={async () => {
                                  try {
                                    const detail = await api.getCandidateDetail(candidate.id);
                                    if (detail) {
                                      setSelectedCandidateDetail(detail);
                                      setIsViewerOpen(true);
                                    } else {
                                      toast.error('Candidate details not found.');
                                    }
                                  } catch (err) {
                                    toast.error('Failed to load candidate details.');
                                  }
                                }}
                                  className="text-left hover:text-primary hover:underline transition-colors"
                                >
                                  {candidate.first_name} {candidate.last_name}
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>{candidate.tracking_code}</TableCell>
                            <TableCell className="min-w-28"><p className="mb-1 text-xs">{Math.round(candidate.progress_percent)}%</p><Progress value={candidate.progress_percent} className="h-1.5" /></TableCell>
                            <TableCell><CandidateRowActions candidate={candidate} profilePath={`/agency/candidate/${candidate.id}`} guidance={guidance.get(candidate.id)} /></TableCell>
                            <TableCell>{localAgency?.name || 'N/A'}</TableCell>
                            <TableCell>
                              <div
                                className={cn(
                                  candidate.payment_status === 'paid' && 'bg-green-500',
                                  candidate.payment_status === 'pending_payment' && 'bg-yellow-500',
                                  candidate.payment_status === 'payment_failed' && 'bg-red-500',
                                  candidate.payment_status === 'unpaid' && 'bg-gray-500',
                                  'text-white px-2 py-1 rounded'
                                )}
                              >
                                {candidate.payment_status.replace(/_/g, ' ')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={statusColors[candidate.overall_status]}>
                                {({ inProgress: 'In progress', pendingQr: 'Pending ministry QR', completed: 'Completed', failed: 'Failed' })[candidateListStatus(candidate)]}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                      <Button size="sm" variant="ghost" onClick={() => { const idx = candidates.findIndex(c => c.id === candidate.id); if (idx >= 0) { setSliderIndex(idx); setIsSliderOpen(true); } }}>
                                        View In Slider
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={async () => {
                                try {
                                  const detail = await api.getCandidateDetail(candidate.id);
                                  if (detail) {
                                    setSelectedCandidateDetail(detail);
                                    setIsViewerOpen(true);
                                  } else {
                                    toast.error('Candidate details not found.');
                                  }
                                } catch (err) {
                                  toast.error('Failed to load candidate details.');
                                }
                                      }}>View</Button>
                                    </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Payment Confirmation Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment for Selected Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You are about to initiate a payment for the following candidates:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {selectedCandidatesForPayment.map(c => (
                <li key={c.id} className="flex items-center gap-2"><CandidateAvatar candidate={c} className="h-8 w-8" />
                  <span>{c.first_name} {c.last_name} ({c.tracking_code}) - Local Agency: {localAgencies.find(la => la.id === c.local_agency_id)?.name || 'N/A'}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between font-bold text-lg border-t pt-4">
              <Label>Total Amount (900 USD baseline per candidate)</Label>
              <span>{totalPaymentAmount.toLocaleString()} {requiredPayment?.currency ?? ''}</span>
            </div>
            <div className="mt-2">
              <Label>Payment currency</Label>
              <div className="mt-1 rounded border bg-muted/40 p-2 text-sm">
                {requiredPayment ? `${requiredPayment.currency} — contract country: ${contractCountry}` : '—'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Foreign agencies pay in the currency of the country where the work contract originates (never ETB). The 900 USD baseline is converted to this currency.</p>
              {paymentBlocker && <p className="mt-1 text-xs text-destructive">{paymentBlocker}</p>}
            </div>
            {paymentMutation.isPending && (
              <div className="flex items-center space-x-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{paymentProcessingMessage}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPaymentDialogOpen(false)} 
              disabled={paymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => paymentMutation.mutate()} 
              disabled={paymentMutation.isPending || !!paymentBlocker || !requiredPayment}
            >
              {paymentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
              Confirm & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate Viewer Dialog (Agency) */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Candidate Viewer</DialogTitle>
          </DialogHeader>
          {selectedCandidateDetail ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center space-x-4">
                <CandidateAvatar candidate={selectedCandidateDetail} className="h-24 w-24" />
                <div>
                  <h3 className="text-lg font-semibold">{selectedCandidateDetail.first_name} {selectedCandidateDetail.last_name}</h3>
                  <p className="text-sm text-muted-foreground">Tracking: {selectedCandidateDetail.tracking_code}</p>
                  <p className="text-sm">Passport: {selectedCandidateDetail.passport_number}</p>
                  <p className="flex items-center gap-2 text-sm">Origin: <CountryFlag country={selectedCandidateDetail.country_of_origin} className="text-base leading-none" />{selectedCandidateDetail.country_of_origin}</p>
                </div>
              </div>

              <CandidateIntroductionMedia candidate={selectedCandidateDetail} compact />
              {selectedCandidateDetail.employment_history?.length ? <div className="border-t pt-4"><EmploymentJourneyHistory candidate={selectedCandidateDetail} showMap={false} /></div> : null}
              <WorkContractHandoff candidate={selectedCandidateDetail} onChanged={async () => {
                const refreshed = await api.getCandidateDetail(selectedCandidateDetail.id);
                setSelectedCandidateDetail(refreshed ?? null);
                queryClient.invalidateQueries({ queryKey: ['agencyCandidates'] });
              }} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Staffing & contract handoff</h4>
                  <p className="text-sm text-muted-foreground">Pick workers on the selection board. Use the contract panel above to send employment documents. Shortlisting does not create a legacy job-matching stage or bypass stage payments.</p>
                  <Button variant="outline" onClick={() => {
                    setIsViewerOpen(false);
                    document.getElementById('worker-selection-board')?.scrollIntoView({ block: 'start' });
                  }}>Back to worker selection</Button>
                </div>

                <div>
                  <h4 className="font-medium">Profile Notes & Stages</h4>
                  <div className="text-sm text-muted-foreground">
                    {selectedCandidateDetail.stages && selectedCandidateDetail.stages.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {selectedCandidateDetail.stages.map(s => (
                          <li key={s.id}>{ALL_STAGES.find(as => as.id === s.stage_id)?.title || `Stage ${s.stage_id}`}: {s.status} {s.notes ? `- ${s.notes}` : ''}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No stages recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">Loading...</div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewerOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staging Slider Dialog (Agency) */}
      <Dialog open={isSliderOpen} onOpenChange={setIsSliderOpen}>
        <DialogContent className="sm:max-w-[900px] max-w-full">
          <DialogHeader>
            <DialogTitle>Staging Slider</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {candidates.length === 0 ? (
              <p className="text-muted-foreground">No staged candidates available.</p>
            ) : (
              (() => {
                const candidate = candidates[sliderIndex % candidates.length];
                if (!candidate) return <p>Invalid candidate selected.</p>;
                return (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <CandidateAvatar candidate={candidate} className="h-24 w-24" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{candidate.first_name} {candidate.last_name}</h3>
                        <p className="text-sm text-muted-foreground">Tracking: {candidate.tracking_code}</p>
                        <p className="text-sm">Passport: {candidate.passport_number}</p>
                        <p className="flex items-center gap-2 text-sm">Origin: <CountryFlag country={candidate.country_of_origin} className="text-base leading-none" />{candidate.country_of_origin}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => setSliderIndex((i) => (i - 1 + candidates.length) % candidates.length)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSliderIndex((i) => (i + 1) % candidates.length)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={!isDemo} onClick={async () => {
                            try {
                              if (!userForeignAgencyId) throw new Error('Foreign agency is not assigned.');
                              setSliderPaymentMessage('Initiating payment...');
                              // Simplified single-candidate placeholder payment flow
                              const faList = await api.getForeignAgencyList();
                              const payer = faList.find(fa => fa.id === userForeignAgencyId);
                              if (!payer) throw new Error('Foreign agency not found');
                              const { checkoutUrl, paymentId } = await api.initiatePayment(payer.id, [candidate.id], user?.id ?? '', user?.email ?? '', currencyForCountry(contractCountryOf(candidate)) ?? undefined);
                              await new Promise(r => setTimeout(r, 1000));
                              const success = true;
                              await api.processPaymentWebhook(paymentId, success ? 'succeeded' : 'failed');
                              setSliderPaymentMessage(success ? 'Payment succeeded' : 'Payment failed');
                              toast.success(success ? 'Payment processed for candidate.' : 'Payment failed.');
                              queryClient.invalidateQueries({ queryKey: ['agencyCandidates'] });
                            } catch (e) {
                              setSliderPaymentMessage('Payment failed');
                              toast.error('Payment failed: ' + (e as Error).message);
                            }
                          }}>{isDemo ? 'Dispense & Pay · demo' : 'Live settlement unavailable'}</Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <h4 className="font-medium">Profile Notes & Stages</h4>
                        <div className="text-sm text-muted-foreground">
                          {/* reuse candidate detail retrieval if available */}
                          <p>Quick stage notes: {candidate.overall_status}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium">Local agency owner</h4>
                        <p className="text-sm text-muted-foreground">{allStaff.find(staff => staff.id === candidate.assigned_staff_id)?.email || 'No local staff owner recorded.'}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Staff assignment is managed by the local agency and superadmin, not recorded as a job-matching stage.</p>
                      </div>
                    </div>

                    {sliderPaymentMessage && <div className="text-sm text-muted-foreground">{sliderPaymentMessage}</div>}
                  </div>
                );
              })()
            )}
          </div>
          <div className="p-4 flex justify-end">
            <Button onClick={() => setIsSliderOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyDashboard;