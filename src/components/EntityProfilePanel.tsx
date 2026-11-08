import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle2, ChevronRight, Clock3, Globe2, GraduationCap, Loader2, Mail, MapPin, Phone, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { getApprovalLogs, getCandidates, getCandidateStages, getCocFacilities, getConfig, getForeignAgencies, getLocalAgencies, getPayments } from '@/lib/data-store';
import { canInspectStaff, canInspectStaffDirectory } from '@/lib/entity-profile-access';
import { getActiveStageTasks } from '@/lib/staff-tasks';
import { calculateOverallStatus } from '@/lib/utils-data';
import { isForeignPayment } from '@/lib/currency';
import { normalizePartnerships } from '@/lib/agency-partnerships';
import type { Payment, StaffUser } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import UserAvatar from './UserAvatar';
import CandidateAvatar from './CandidateAvatar';
import LastOnline from './LastOnline';
import PaymentLedgerSummary from './PaymentLedgerSummary';
import PaymentEvidenceReview from './PaymentEvidenceReview';
import AgencyResolutionCenter from './AgencyResolutionCenter';

export type EntityKind = 'local-agency' | 'foreign-agency' | 'coc' | 'staff' | 'staff-directory';
interface Props {
  kind: EntityKind; entityId: string; section: string; onSectionChange: (section: string) => void;
  onOpenEntity: (kind: EntityKind, id: string) => void;
  onOpenCandidate: (id: string, options?: { tab?: string; stageId?: number }) => void;
}
export default function EntityProfilePanel(props: Props) {
  const auth = useAuth();
  const viewer = { role: auth.userRole, id: auth.viewAs?.userId ?? auth.user?.id, localAgencyId: auth.userLocalAgencyId, foreignAgencyId: auth.userForeignAgencyId };
  const staffView = props.kind === 'staff' || props.kind === 'staff-directory';
  const allowed = staffView ? props.kind !== 'staff-directory' || canInspectStaffDirectory(viewer) : auth.userRole === 'superadmin';
  const data = useQuery({
    queryKey: ['entity-profile', auth.isDemo, viewer.id, viewer.role, viewer.localAgencyId, viewer.foreignAgencyId, props.kind, props.entityId],
    enabled: allowed,
    queryFn: async () => ({
      users: await api.getAllStaffUsers(), candidates: getCandidates(), stages: getCandidateStages(),
      locals: getLocalAgencies(), foreigns: getForeignAgencies(), centers: getCocFacilities(),
      payments: getPayments(), partnerships: normalizePartnerships(getConfig().agencyPartnerships),
      logs: getApprovalLogs(),
    }),
    refetchInterval: 15000,
  });
  const refetch = data.refetch;
  useEffect(() => {
    if (!allowed) return;
    const refresh = () => void refetch();
    window.addEventListener('supabase-data-changed', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [allowed, refetch]);
  if (!allowed) return <p role="alert">This profile is only available to an authorized administrator.</p>;
  if (data.isLoading) return <p role="status" className="flex gap-2 p-8"><Loader2 className="h-5 w-5 animate-spin" />Loading profile…</p>;
  if (data.error || !data.data) return <div role="alert" className="p-8"><p>{data.error?.message ?? 'Could not load this profile.'}</p><Button onClick={() => void data.refetch()}>Retry profile</Button></div>;
  return <ProfileContent {...props} viewer={viewer} data={data.data} />;
}
type ProfileData = {
  users: StaffUser[]; candidates: ReturnType<typeof getCandidates>; stages: ReturnType<typeof getCandidateStages>;
  locals: ReturnType<typeof getLocalAgencies>; foreigns: ReturnType<typeof getForeignAgencies>; centers: ReturnType<typeof getCocFacilities>;
  payments: Payment[]; partnerships: ReturnType<typeof normalizePartnerships>; logs: ReturnType<typeof getApprovalLogs>;
};
function ProfileContent({ kind, entityId, section, onSectionChange, onOpenEntity, onOpenCandidate, viewer, data }: Props & {
  viewer: Parameters<typeof canInspectStaff>[0]; data: ProfileData;
}) {
  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<Payment['status'] | 'all'>('all');
  const users = data.users.filter(user => canInspectStaff(viewer, user));
  const staff = kind === 'staff' ? users.find(user => user.id === entityId) : undefined;
  const entity = kind === 'local-agency' ? data.locals.find(entity => entity.id === entityId)
    : kind === 'foreign-agency' ? data.foreigns.find(entity => entity.id === entityId)
      : kind === 'coc' ? data.centers.find(entity => entity.id === entityId) : undefined;
  if (kind !== 'staff-directory' && !staff && !entity) return <p role="alert" className="p-8">This profile is unavailable or outside your access. Close this tab to return.</p>;
  const isAdmin = viewer.role === 'superadmin' || viewer.role === 'admin';
  const assigned = data.candidates.filter(candidate => kind === 'staff'
    ? (candidate.assigned_staff_id === entityId || data.stages.some(stage => stage.candidate_id === candidate.id && stage.assigned_staff_id === entityId))
      && (isAdmin || viewer.role === 'local-agency' && candidate.local_agency_id === viewer.localAgencyId
        || viewer.role === 'staff' && viewer.id === entityId && (!viewer.localAgencyId || candidate.local_agency_id === viewer.localAgencyId)
        || ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(viewer.role ?? '') && !!viewer.foreignAgencyId && (candidate.foreign_agency_id === viewer.foreignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === viewer.foreignAgencyId)))
    : kind === 'local-agency' ? candidate.local_agency_id === entityId
      : kind === 'foreign-agency' ? candidate.foreign_agency_id === entityId || candidate.profile_shares?.some(share => share.foreign_agency_id === entityId)
        : candidate.coc_facility_id === entityId);
  const ownUsers = kind === 'staff-directory' ? users : users.filter(user => kind === 'local-agency' ? user.local_agency_id === entityId : kind === 'foreign-agency' ? user.foreign_agency_id === entityId : user.id === entityId);
  const tasks = getActiveStageTasks(assigned, data.stages).filter(task => kind !== 'staff' || task.stage.assigned_staff_id === entityId);
  const payments = data.payments.filter(payment => kind === 'local-agency' ? payment.payee_local_agency_id === entityId : kind === 'foreign-agency' && isForeignPayment(payment) && payment.payer_foreign_agency_id === entityId);
  const partnerships = data.partnerships.filter(partner => kind === 'local-agency' ? partner.local_agency_id === entityId : kind === 'foreign-agency' && partner.foreign_agency_id === entityId);
  const candidateIds = new Set(assigned.map(candidate => candidate.id));
  const paymentIds = new Set(payments.map(payment => payment.id));
  const userIds = new Set(ownUsers.map(user => user.id));
  const logs = isAdmin ? data.logs.filter(log => kind === 'staff' ? log.actor_id === entityId || log.target_type === 'StaffUser' && log.target_id === entityId
    : log.target_type === 'Candidate' && candidateIds.has(log.target_id) || log.target_type === 'Payment' && paymentIds.has(log.target_id) || log.target_type === 'StaffUser' && userIds.has(log.target_id)).sort((a,b) => b.timestamp.localeCompare(a.timestamp)) : [];
  const name = staff?.email ?? entity?.name ?? 'Staff directory';
  const Icon = kind === 'staff' || kind === 'staff-directory' ? Users : kind === 'foreign-agency' ? Globe2 : kind === 'coc' ? GraduationCap : Building2;
  const staffList = <div className="space-y-3">
    <Input aria-label="Search staff profiles" placeholder="Search staff by email or role" value={search} onChange={e => setSearch(e.target.value)} />
    <p className="text-sm text-muted-foreground">{ownUsers.length} staff accounts · click a person to open their profile</p>
    <div className="grid gap-3 md:grid-cols-2">{ownUsers.filter(user => `${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase())).map(user => <button key={user.id} onClick={() => onOpenEntity('staff', user.id)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"><UserAvatar user={user} className="h-12 w-12" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{user.email}</p><p className="text-sm text-muted-foreground">{user.role} · {user.is_approved ? 'Approved' : 'Awaiting approval'}</p><LastOnline at={user.last_online_at} /></div><ChevronRight className="h-4 w-4" /></button>)}</div>
    {!ownUsers.length && <p>No staff accounts linked.</p>}
  </div>;
  const roster = <div className="space-y-3"><Input aria-label="Search profile candidates" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or tracking code" /><p className="text-sm text-muted-foreground">{assigned.length} assigned / shared candidates</p><div className="grid gap-3 md:grid-cols-2">{assigned.filter(candidate => `${candidate.first_name} ${candidate.last_name} ${candidate.tracking_code}`.toLowerCase().includes(search.toLowerCase())).map(candidate => <button key={candidate.id} onClick={() => onOpenCandidate(candidate.id)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:border-primary"><CandidateAvatar candidate={candidate} /><div className="min-w-0 flex-1"><p className="font-semibold">{candidate.first_name} {candidate.last_name}</p><p className="text-xs text-muted-foreground">{candidate.tracking_code}</p></div><Badge variant="outline">{calculateOverallStatus(data.stages.filter(stage => stage.candidate_id === candidate.id))}</Badge></button>)}</div>{!assigned.length && <p>No candidate records linked.</p>}</div>;
  const activeSection = section === 'overview' ? 'overview' : section;
  return <div className="space-y-5">
    <header className="rounded-3xl border border-sky-500/25 bg-gradient-to-br from-sky-500/15 via-card to-violet-500/10 p-6">
      <div className="flex flex-wrap items-center gap-4">{staff ? <UserAvatar user={staff} className="h-16 w-16" /> : <span className="rounded-2xl bg-sky-500/15 p-4 text-sky-600 dark:text-sky-300"><Icon className="h-8 w-8" /></span>}<div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{kind.replace(/-/g, ' ')} · authorized profile</p><h2 className="break-words text-2xl font-bold md:text-3xl">{name}</h2><p className="mt-1 text-sm text-muted-foreground">{staff ? `${staff.role} · ${staff.is_approved ? 'Approved' : 'Awaiting approval'}` : 'Linked people, candidate movement, financial records and review history in one place.'}</p></div>{viewer.role === 'superadmin' && <Badge variant="outline"><ShieldCheck className="mr-1 h-4 w-4" />Superadmin insight</Badge>}</div>
    </header>
    {kind === 'staff-directory' ? staffList : <Tabs value={activeSection} onValueChange={onSectionChange} className="space-y-5">
      <TabsList aria-label="Entity profile sections"><TabsTrigger value="overview"><Building2 aria-hidden="true" />Overview</TabsTrigger><TabsTrigger value="candidates"><Users aria-hidden="true" />Candidates ({assigned.length})</TabsTrigger>{!staff && kind !== 'coc' && <TabsTrigger value="staff"><Users aria-hidden="true" />Staff ({ownUsers.length})</TabsTrigger>}{staff && <TabsTrigger value="tasks"><Clock3 aria-hidden="true" />Follow-ups ({tasks.length})</TabsTrigger>}{!staff && kind !== 'coc' && <TabsTrigger value="finance"><Wallet aria-hidden="true" />Finance</TabsTrigger>}{isAdmin && <TabsTrigger value="activity"><ShieldCheck aria-hidden="true" />Audit activity</TabsTrigger>}{!staff && kind !== 'coc' && <TabsTrigger value="review"><CheckCircle2 aria-hidden="true" />Review & appeals</TabsTrigger>}</TabsList>
      <TabsContent value="overview" forceMount className="space-y-5 data-[state=inactive]:hidden">
        <div className="grid gap-3 sm:grid-cols-3">{[{ label: 'Linked candidates', value: assigned.length, icon: Users, tab: 'candidates' }, { label: 'Active follow-ups', value: tasks.length, icon: Clock3, tab: staff ? 'tasks' : 'candidates' }, { label: staff ? 'Overdue follow-ups' : 'Completed journeys', value: staff ? tasks.filter(task => task.overdue).length : assigned.filter(candidate => calculateOverallStatus(data.stages.filter(stage => stage.candidate_id === candidate.id)) === 'Completed').length, icon: CheckCircle2, tab: staff ? 'tasks' : 'candidates' }].map(stat => <button key={stat.label} onClick={() => onSectionChange(stat.tab)} className="rounded-2xl border bg-card p-5 text-left hover:bg-primary/5"><stat.icon className="mb-3 h-6 w-6 text-primary" /><p className="text-3xl font-bold tabular-nums">{stat.value}</p><p className="text-sm text-muted-foreground">{stat.label}</p></button>)}</div>
        <Card><CardContent className="grid gap-5 p-6 sm:grid-cols-2">
          {[{ icon: Mail, label: 'Contact email', value: staff?.email ?? entity?.contact_email }, { icon: Phone, label: 'Phone', value: staff?.phone_number ?? entity?.phone_number }, { icon: MapPin, label: 'Address', value: entity?.address }, { icon: Clock3, label: 'Registered', value: staff?.created_at ?? entity?.created_at }].map(({ icon: DetailIcon, label, value }) => <div key={label} className="flex gap-3"><DetailIcon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="break-words font-medium">{value || 'Not recorded'}</p></div></div>)}
          {staff?.local_agency_id && <Button variant="outline" disabled={viewer.role !== 'superadmin'} onClick={() => onOpenEntity('local-agency', staff.local_agency_id!)}><Building2 className="mr-2 h-4 w-4" />{data.locals.find(agency => agency.id === staff.local_agency_id)?.name ?? 'Local agency linked'}</Button>}
          {staff?.foreign_agency_id && <Button variant="outline" disabled={viewer.role !== 'superadmin'} onClick={() => onOpenEntity('foreign-agency', staff.foreign_agency_id!)}><Globe2 className="mr-2 h-4 w-4" />{data.foreigns.find(agency => agency.id === staff.foreign_agency_id)?.name ?? 'Foreign agency linked'}</Button>}
        </CardContent></Card>
        {!staff && !!partnerships.length && <section className="space-y-3"><h3 className="text-lg font-semibold">Partner network</h3><div className="grid gap-3 md:grid-cols-2">{partnerships.map(partner => {
          const local = kind === 'foreign-agency'; const id = local ? partner.local_agency_id : partner.foreign_agency_id;
          const partnerName = (local ? data.locals : data.foreigns).find(entity => entity.id === id)?.name;
          return <Button key={id} variant="outline" className="h-auto justify-between p-4" onClick={() => onOpenEntity(local ? 'local-agency' : 'foreign-agency', id)}><span className="min-w-0 truncate">{partnerName ?? 'Partner unavailable'}</span><Badge variant="outline">{partner.status}</Badge></Button>;
        })}</div></section>}
        {staff?.profile_edit_pending && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">This staff account has a profile change awaiting approval. The information above is the current recorded profile.</p>}
      </TabsContent>
      <TabsContent value="candidates" forceMount className="data-[state=inactive]:hidden">{roster}</TabsContent>
      <TabsContent value="staff" forceMount className="data-[state=inactive]:hidden">{staffList}</TabsContent>
      <TabsContent value="tasks" forceMount className="space-y-3 data-[state=inactive]:hidden">{tasks.map(task => <article key={task.stage.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><p className="font-semibold">{task.candidate.first_name} {task.candidate.last_name}</p><p className="text-sm text-muted-foreground">{task.stageTitle} · {task.action} · Due {new Date(task.dueAt).toLocaleDateString()}</p></div><Badge variant={task.overdue ? 'destructive' : 'outline'}>{task.overdue ? 'Overdue' : 'Scheduled'}</Badge><Button variant="outline" onClick={() => onOpenCandidate(task.candidate.id, { tab: 'timeline', stageId: task.stage.stage_id })}>Open exact stage</Button></article>)}{!tasks.length && <p>No active assigned stage follow-ups.</p>}</TabsContent>
      <TabsContent value="finance" forceMount className="space-y-4 data-[state=inactive]:hidden"><PaymentLedgerSummary payments={payments} status={paymentStatus} onStatusChange={setPaymentStatus} /><p className="text-sm text-muted-foreground">Original amounts below. Select a receipt for evidence and who initiated it.</p>{payments.filter(payment => paymentStatus === 'all' || payment.status === paymentStatus).sort((a,b) => b.created_at.localeCompare(a.created_at)).map(payment => <button key={payment.id} className="flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left hover:bg-primary/5" onClick={() => setReceipt(payment)}><Wallet className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block font-semibold">{payment.amount.toLocaleString()} {payment.currency}</span><span className="block truncate text-xs text-muted-foreground">{payment.receipt_number ?? payment.provider_reference ?? payment.id}</span></span><Badge variant="outline">{payment.status}</Badge><ChevronRight className="h-4 w-4" /></button>)}{!payments.length && <p>No recorded payments for this agency.</p>}</TabsContent>
      <TabsContent value="activity" forceMount className="space-y-3 data-[state=inactive]:hidden">{logs.slice(0,100).map(log => <article key={log.id} className="rounded-2xl border-l-4 border-primary bg-muted/30 p-4"><div className="flex flex-wrap justify-between gap-2"><Badge variant="outline">{log.action} · {log.target_type}</Badge><time className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</time></div><p className="mt-2 break-words text-sm">{log.description}</p><p className="mt-2 text-xs text-muted-foreground">By {log.actor_email}</p></article>)}{!logs.length && <p>No related audit records.</p>}{logs.length>100&&<p className="text-sm text-muted-foreground">Showing the latest 100 audit events.</p>}</TabsContent>
      <TabsContent value="review" forceMount className="data-[state=inactive]:hidden">{(kind === 'local-agency' || kind === 'foreign-agency') && <AgencyResolutionCenter agencyScope={{ type: kind === 'local-agency' ? 'local' : 'foreign', id: entityId }} />}</TabsContent>
    </Tabs>}
    <PaymentEvidenceReview agencyId={receipt?.payee_local_agency_id ?? ''} evidence={receipt ? { caseId: receipt.id, payment: receipt } : null} statementName="Agency-linked payment evidence" onClose={() => setReceipt(null)} />
  </div>;
}
