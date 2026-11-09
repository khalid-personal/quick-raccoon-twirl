import React, { useState } from 'react';
import { useReturnToPrevious } from '@/hooks/use-page-memory';
import { useIsMobile } from '@/hooks/use-mobile';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, ArrowLeft, Send, Clock3, Files, FileCheck2, Wallet, HeartPulse, Bell, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, Navigate } from 'react-router-dom';
import CandidateAvatar from '@/components/CandidateAvatar';
import CandidateProfile from '@/components/CandidateProfile';
import TimelineEditor from '@/components/TimelineEditor';
import DocumentManager from '@/components/DocumentManager';
import ContractVisaPanel from '@/components/ContractVisaPanel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CandidateDetailEditor from '@/components/CandidateDetailEditor';
import CandidateContacts from '@/components/CandidateContacts';
import CandidateIntroductionMedia from '@/components/CandidateIntroductionMedia';
import CandidateMapDialog from '@/components/CandidateMapDialog';
import EmploymentJourneyHistory from '@/components/EmploymentJourneyHistory';
import CandidatePayments from '@/components/CandidatePayments';
import MedicalResultsEditor from '@/components/MedicalResultsEditor';
import NotificationSender from '@/components/NotificationSender';
import AdminChatViewer from '@/components/AdminChatViewer';
import { useAuth } from '@/lib/auth-context';
import { calculateProgress, getCandidatePriority } from '@/lib/utils-data';
import { toast } from 'sonner'; // NEW IMPORT
import { normalizePartnerships, partnersForLocalAgency } from '@/lib/agency-partnerships';
import { hasCompleteCandidateIntroduction } from '@/lib/candidate-introduction';

export interface CandidateWorkspaceOptions { candidateId: string; tab: string; stageId?: number; onTabChange: (tab: string) => void; onStageHandled: () => void; onMinimize: () => void; }
const AdminCandidateDetail: React.FC<{ workspace?: CandidateWorkspaceOptions }> = ({ workspace }) => {
  const { candidateId: routeCandidateId } = useParams<{ candidateId: string }>();
  const candidateId = workspace?.candidateId ?? routeCandidateId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const queryClient = useQueryClient();
  const { userRole, userLocalAgencyId, userForeignAgencyId, user, viewAs } = useAuth();
  
  const actorId = viewAs?.userId || user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';
  const dashboardPath = userRole === 'local-agency' ? '/local-agency'
    : userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'agency' ? '/agency' : '/admin';
  const returnToPrevious = useReturnToPrevious(dashboardPath);
  const mobile = useIsMobile();
  const profileSection = !!workspace || mobile || searchParams.get('tab') === 'profile';
  const backControl = !workspace && <div className="candidate-mobile-back sticky top-0 z-30 -mx-1 flex items-center gap-3 rounded-xl border bg-card/95 p-2 backdrop-blur md:hidden"><Button variant="ghost" onClick={returnToPrevious} className="min-h-11"><ArrowLeft className="mr-2 h-5 w-5" />Back to previous page</Button></div>;
  const staffId = viewAs?.userId ?? user?.id;

  const activeTab = workspace?.tab ?? searchParams.get('tab') ?? (mobile ? 'profile' : 'timeline');
  const setActiveTab = (tab: string) => {
    if (workspace) { workspace.onTabChange(tab); return; }
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'timeline') next.delete('stage');
    setSearchParams(next, { replace: true });
  };

  const { data: candidate, isLoading, error, refetch } = useQuery({
    queryKey: ['candidateDetail', candidateId],
    queryFn: () => api.getCandidateDetail(candidateId!),
    enabled: !!candidateId,
  });
  const { data: config } = useQuery({ queryKey: ['agency-partnership-config'], queryFn: api.getAppConfig, enabled: userRole === 'local-agency' });
  const partners = partnersForLocalAgency(normalizePartnerships(config?.agencyPartnerships), candidate?.local_agency_id ?? '')
    .filter(partnership => partnership.status === 'active')
    .map(partnership => config?.foreignAgencies.find(agency => agency.id === partnership.foreign_agency_id))
    .filter((agency): agency is NonNullable<typeof agency> => !!agency);
  const selectedPartnerId = partners.some(agency => agency.id === partnerId) ? partnerId : partners.find(agency => agency.id === candidate?.foreign_agency_id)?.id ?? partners[0]?.id ?? '';

  const handleSendProfile = async () => {
    if (!candidate || !selectedPartnerId) return;
    try {
      await api.sendProfileToForeignAgency(candidate.id, candidate.tracking_code, selectedPartnerId, actorId, actorEmail);
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['localDashboardCandidates'] }), queryClient.invalidateQueries({ queryKey: ['agencyCandidates'] })]);
      toast.success(`Candidate profile for ${candidate.tracking_code} sent to ${partners.find(agency => agency.id === selectedPartnerId)?.name}.`);
    } catch (error) {
      toast.error(`Failed to send profile: ${(error as Error).message}`);
    }
  };

  if (isLoading) {
    return (
      <div>{backControl}<div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div></div>
    );
  }

  if (error || !candidate) {
    return (
      <div>{backControl}<div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">Error Loading Candidate</h1>
        <p role="alert" className="text-muted-foreground">{error instanceof Error ? error.message : `Candidate ID ${candidateId} not found.`}</p>
        {error && <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Retry profile</Button>}
          <Button variant="outline" className="mt-4" onClick={workspace?.onMinimize ?? returnToPrevious}>
            <ArrowLeft className="h-4 w-4 mr-2" />{workspace ? 'Return to list' : 'Back to Dashboard'}
          </Button>
      </div></div>
    );
  }

  const canViewCandidate = userRole === 'superadmin' || userRole === 'admin'
    || (userRole === 'staff' && (!userLocalAgencyId || candidate.local_agency_id === userLocalAgencyId)
      && (candidate.assigned_staff_id === staffId || candidate.stages.some(stage => stage.assigned_staff_id === staffId)))
    || (userRole === 'local-agency' && candidate.local_agency_id === userLocalAgencyId)
    || ((userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'agency')
      && (candidate.foreign_agency_id === userForeignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === userForeignAgencyId)));
  if (!canViewCandidate) return workspace ? <p role="alert" className="p-8">You do not have access to this candidate. Close this tab to return to your list.</p> : <Navigate to={dashboardPath} replace />;

  const isLocalAgencyUser = userRole === 'local-agency';
  // Check if the local agency user's associated local agency name matches the candidate's local agency name
  const canSendProfile = isLocalAgencyUser && candidate.local_agency_id === userLocalAgencyId && partners.length > 0;
  const introductionComplete = hasCompleteCandidateIntroduction(candidate);

  // Compute progress and priority for header highlighting
  const progressPercent = candidate ? calculateProgress(candidate.stages) : 0;
  const priority = candidate ? getCandidatePriority(candidate.created_at, progressPercent) : 'green';

  return (
    <div className="candidate-detail-view space-y-6">
      {backControl}
      <div className="candidate-identity-header flex flex-wrap items-center justify-between gap-5 rounded-3xl border p-5 sm:p-7">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
          <CandidateAvatar candidate={candidate} className="h-12 w-12" />
          <span>
            {candidate.first_name} {candidate.last_name}
          </span>
          <span className="candidate-tracking-code text-sm font-normal break-all">({candidate.tracking_code})</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priority === 'green' ? 'bg-[#c8f575] text-[#173b32]' : priority === 'yellow' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>{progressPercent}% stages complete</span>
        </h1>
        <div className="flex flex-wrap gap-2">
            <CandidateMapDialog candidate={candidate} />
            {canSendProfile && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selectedPartnerId} onValueChange={setPartnerId}>
                    <SelectTrigger aria-label="Foreign partner" className="w-48 max-w-full"><SelectValue placeholder="Choose partner" /></SelectTrigger>
                    <SelectContent>{partners.map(agency => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={handleSendProfile} variant="default" disabled={!introductionComplete}><Send className="h-4 w-4 mr-2" />{candidate.profile_shares?.some(share => share.foreign_agency_id === selectedPartnerId) ? 'Resend profile' : 'Send profile'}</Button>
                  {!introductionComplete && <p className="max-w-48 text-xs text-amber-700">Complete required profile details before sharing.</p>}
                </div>
            )}
            {
              (() => {
                const path = userRole === 'local-agency' ? `/local-agency/agency-chat?candidateId=${candidate.id}` : (userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' ? `/agency/chat?candidateId=${candidate.id}` : `/admin/agency-chat?candidateId=${candidate.id}`);
                return (
                  <Link to={path}>
                    <Button variant="outline">View Agency Conversations</Button>
                  </Link>
                );
              })()
            }
                <Button variant="outline" className={!workspace ? 'hidden md:inline-flex' : undefined} onClick={workspace?.onMinimize ?? returnToPrevious}>
                    <ArrowLeft className="h-4 w-4 mr-2" />{workspace ? 'Return to list' : 'Back to Dashboard'}
                </Button>
        </div>
      </div>

      {!profileSection && <><CandidateProfile candidate={candidate} onEdit={() => setIsEditDialogOpen(true)} onChanged={refetch} />
      <CandidateIntroductionMedia candidate={candidate} />
      <CandidateContacts key={candidate.updated_at} candidate={candidate} onChanged={refetch} />
      <EmploymentJourneyHistory candidate={candidate} /></>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList aria-label="Candidate profile sections" data-tour="candidate-stages" className="w-full">
          {(profileSection || activeTab === 'profile') && <TabsTrigger value="profile">Profile</TabsTrigger>}
          <TabsTrigger value="timeline"><Clock3 className="h-5 w-5" />Timeline</TabsTrigger>
          <TabsTrigger value="documents"><Files className="h-5 w-5" />Documents</TabsTrigger>
          <TabsTrigger value="contract"><FileCheck2 className="h-5 w-5" />Contract & Visa</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="h-5 w-5" />Payments</TabsTrigger>
          <TabsTrigger value="medical"><HeartPulse className="h-5 w-5" />Medical</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-5 w-5" />Notifications</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="h-5 w-5" />Chat</TabsTrigger>
        </TabsList>
        
        {profileSection && <TabsContent forceMount={workspace ? true : undefined} value="profile" className="space-y-4 data-[state=inactive]:hidden"><CandidateProfile candidate={candidate} onEdit={() => setIsEditDialogOpen(true)} onChanged={refetch} /><CandidateIntroductionMedia candidate={candidate} /><CandidateContacts key={candidate.updated_at} candidate={candidate} onChanged={refetch} /><EmploymentJourneyHistory candidate={candidate} /></TabsContent>}
        <TabsContent forceMount={workspace ? true : undefined} value="timeline" className="mt-4 data-[state=inactive]:hidden">
          <TimelineEditor candidateDetail={candidate} refetch={refetch} workspace={workspace ? { stageId: workspace.stageId, onStageHandled: workspace.onStageHandled } : undefined} />
        </TabsContent>
        
        <TabsContent forceMount={workspace ? true : undefined} value="documents" className="mt-4 data-[state=inactive]:hidden">
          <DocumentManager candidateDetail={candidate} refetch={refetch} />
        </TabsContent>
        
        <TabsContent forceMount={workspace ? true : undefined} value="contract" className="mt-4 data-[state=inactive]:hidden">
          <ContractVisaPanel candidateDetail={candidate} refetch={refetch} />
        </TabsContent>

        <TabsContent forceMount={workspace ? true : undefined} value="payments" className="mt-4 data-[state=inactive]:hidden">
          <CandidatePayments candidateDetail={candidate} />
        </TabsContent>

        <TabsContent forceMount={workspace ? true : undefined} value="medical" className="mt-4 data-[state=inactive]:hidden">
          <MedicalResultsEditor candidateDetail={candidate} refetch={refetch} />
        </TabsContent>
        
        <TabsContent forceMount={workspace ? true : undefined} value="notifications" className="mt-4 data-[state=inactive]:hidden">
          <NotificationSender candidate={candidate} />
        </TabsContent>
        
        <TabsContent forceMount={workspace ? true : undefined} value="chat" className="mt-4 data-[state=inactive]:hidden">
          <AdminChatViewer candidate={candidate} />
        </TabsContent>
      </Tabs>
      
      {/* Edit Candidate Details Dialog */}
<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
  <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-auto">
    <DialogHeader>
      <DialogTitle>Candidate source details</DialogTitle>
      <DialogDescription>Ministry-owned profile information is read-only. Review the recorded details without changing source identity or CoC assignments.</DialogDescription>
    </DialogHeader>
    {candidate && (
      <CandidateDetailEditor 
        candidate={candidate} 
        onSuccess={refetch} 
        onClose={() => setIsEditDialogOpen(false)} 
      />
    )}
  </DialogContent>
</Dialog>

    </div>
  );
};

export default AdminCandidateDetail;