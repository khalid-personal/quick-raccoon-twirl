import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { readWalkthrough, startWalkthrough } from '@/lib/portal-walkthrough';
import type { UserRole } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';

interface GuideStep {
  title: string;
  what: string;
  next: string;
  href: string;
}

const commonSteps: GuideStep[] = [
  { title: 'Follow the candidate journey', what: 'Each stage shows what is finished, what is active, and what still needs work.', next: 'Open a candidate and review the next unfinished stage.', href: '/admin' },
  { title: 'Keep records clear', what: 'Documents are screened for basic file risks. A review flag means a person should check the file; it does not prove fraud.', next: 'Open a flagged file and resolve it using your organization’s process.', href: '/admin/integrity' },
];

const roleSteps: Record<UserRole, GuideStep[]> = {
  superadmin: [
    { title: 'Start with oversight and investigations', what: 'Agency flow shows registration-to-deployment progress, fee blockers and overdue work. My tasks lists flags, agency replies and approvals—not staff assignments.', next: 'Review evidence, escalate suspicious issues for ministry review or close with a recorded reason. Decide agency appeals in Payment issues. Local agency admins balance staff work.', href: '/admin/tasks' },
    { title: 'Review record warnings', what: 'Warnings show records that need a closer look. Correct the missing or conflicting details rather than hiding the warning.', next: 'Open Record checks and start with urgent issues.', href: '/admin/integrity' },
    { title: 'Practice with demo records', what: 'Six examples show different progress, collections and workload while keeping the same candidates.', next: 'Open Switch scenario in the top bar and select a card. It applies immediately in demo mode.', href: '/admin' },
    { title: 'Review online staff', what: 'The green dot means the account was recently active. Recorded attendance begins at sign-in and ends at logout.', next: 'Review the staff list or attendance history.', href: '/admin/users' },
    { title: 'Manage access and fees', what: 'Approved accounts determine who can enter each workspace. Stage fees are shown to candidates before payment.', next: 'Review staff approvals, agency access, and stage fees.', href: '/admin/settings' },
    { title: 'Review payments', what: 'Payment records link the candidate, stage, amount, and receipt reference.', next: 'Check payment status and open a receipt when a payment is confirmed.', href: '/admin/payments' },
    { title: 'Read system messages', what: 'Candidate chats, notifications, and audit entries help your team coordinate and trace decisions.', next: 'Click the floating chat icon at bottom right for threads or New chat; notifications stay in their own list.', href: '/admin/chat' },
    ...commonSteps,
  ],
  staff: [
    { title: 'Start with My Tasks', what: 'Your queue lists the next stage or follow-up assigned to you, with due dates and the candidate’s progress.', next: 'Open a task, contact the candidate, and record the next action.', href: '/admin/tasks' },
    { title: 'Follow ministry stages', what: 'Stage statuses, medical results and deployment update from ministry records.', next: 'Review the source record, attach supporting evidence and set a task follow-up when needed.', href: '/admin' },
    { title: 'Check flagged records', what: 'File and workflow warnings help you find mismatches and records that may be off track.', next: 'Review the finding and update the underlying record.', href: '/admin/integrity' },
    { title: 'Attendance is automatic', what: 'Your work session begins when you sign in and ends when you log out.', next: 'Use Log out when you finish for the day.', href: '/admin/attendance' },
    { title: 'Keep in touch', what: 'Candidate chat and notifications keep follow-ups attached to the candidate workflow.', next: 'Click the bottom-right chat icon, select a thread or New chat, then record the next action on the task.', href: '/admin/chat' },
  ],
  'local-agency': [
    { title: 'Start with My tasks and team workload', what: 'Your queue includes record warnings, agency replies and contract receipt checks. Team work stays within your agency.', next: 'Open My tasks, review owners and due dates, then assign or balance work among your approved staff.', href: '/local-agency/tasks' },
    { title: 'Review candidate progress', what: 'The dashboard summarizes each stage and lists blocked, flagged, or inactive candidate files.', next: 'Open the candidate row to review the next step.', href: '/local-agency' },
    { title: 'Confirm received contracts', what: 'The foreign agency shares a secure contract link. Your agency confirms once the contract has arrived.', next: 'Open the candidate profile and mark the contract received.', href: '/local-agency' },
    { title: 'Follow clearance references', what: 'Visa, Enjaz, Tasheer and QR reference numbers arrive from the ministry.', next: 'Explore the read-only reference console and follow up on awaiting records.', href: '/local-agency/clearance' },
    { title: 'Review payments and messages', what: 'Candidate fees, receipts, and chat stay linked to your agency’s candidate records.', next: 'Open payments to review receipts. Missing contract transfers need follow-up with the foreign agency. Use the bottom-right icon for chat.', href: '/local-agency/payments' },
    ...commonSteps,
  ],
  'foreign-agency': [
    { title: 'Start with My tasks and team workload', what: 'Your follow-ups and approved staff assignments stay within your foreign agency; they do not replace local-stage ownership.', next: 'Read My tasks, review work by staff member, then assign a task or use Balance agency work.', href: '/agency/tasks' },
    { title: 'Review candidate introductions', what: 'Candidate summaries, skills, languages, and introduction videos help you review a profile before sending a contract.', next: 'Open a candidate from your agency dashboard.', href: '/agency' },
    { title: 'Send a contract link', what: 'Share a secure HTTPS link with the candidate’s linked Ethiopian agency. The other agency confirms receipt.', next: 'Open the candidate viewer and send the contract link.', href: '/agency' },
    { title: 'Track clearance', what: 'The tracker shows local checks and whether the Labour Ministry certificate has been issued.', next: 'Review the candidate’s clearance status.', href: '/agency/clearance' },
    { title: 'Make contract payments and keep receipts', what: 'After the work contract is sent, your foreign agency must pay the receiving local agency. No successful covering receipt means unpaid.', next: 'Open Make contract payment in My tasks, use the candidate Payments tab, then check Money sent for the receipt. Use the bottom-right icon for chat.', href: '/agency/tasks' },
  ],
  'foreign-agency-staff': [
    { title: 'Start with My tasks', what: 'Only your assigned current-stage work is listed. Payment blockers still apply.', next: 'Open your earliest task, read the candidate record and save a permitted follow-up.', href: '/agency/tasks' },
    { title: 'Review candidate introductions', what: 'Candidate summaries, skills, languages, and introduction videos help you review a profile before sending a contract.', next: 'Open a candidate from your agency dashboard.', href: '/agency' },
    { title: 'Track a contract', what: 'The foreign agency shares a secure contract link; the linked Ethiopian agency marks it received.', next: 'Open the candidate viewer to check the handoff.', href: '/agency' },
    { title: 'Follow clearance', what: 'See visa and clearance progress for candidates linked to your agency.', next: 'Open the clearance tracker.', href: '/agency/clearance' },
    { title: 'Coordinate candidate follow-up', what: 'Use chat and the candidate timeline to keep agency communication connected to the file.', next: 'Use the bottom-right chat icon. For missing post-contract payment, follow up with your foreign agency manager, not the candidate.', href: '/agency/chat' },
  ],
  candidate: [
    { title: 'Read your document reminders', what: 'Your tracking page gives helpful reminders for missing current-stage documents, not staff assignments or penalties.', next: 'Ask the agency what is needed, then open documents and submit it to the correct stage.', href: '/track' },
    { title: 'Check your journey', what: 'Your timeline shows each step and its current status.', next: 'Open the next stage and read any action requested by your agency.', href: '/track' },
    { title: 'Share documents safely', what: 'Uploads are screened for common file risks. A review message means the agency should check the file.', next: 'Choose the stage and upload the requested document.', href: '/track' },
    { title: 'View your profile', what: 'Your photo, introduction, and recorded progress help your agencies work from one current profile.', next: 'Ask your local agency to correct anything that is out of date.', href: '/track' },
    { title: 'Contact your agency', what: 'Use candidate chat for a question about a stage, document, payment, or follow-up.', next: 'Click the bottom-right chat icon on your tracking page, then open your thread or choose New chat.', href: '/track' },
  ],
  auditor: [
    { title: 'Start with My tasks', what: 'Your queue groups active warnings into read-only reviews. A score summarizes warnings; it does not prove wrongdoing.', next: 'Open the highest-priority review and check supporting evidence without changing records.', href: '/auditor/tasks' },
    { title: 'Review record warnings', what: 'Checks look for missing or conflicting candidate, stage, payment and document details.', next: 'Review the supporting records and activity history for each issue.', href: '/auditor' },
    { title: 'Understand review findings', what: 'A finding identifies a record that needs review; it is not a conclusion of wrongdoing.', next: 'Inspect the evidence available in the integrity workspace.', href: '/auditor' },
  ],
  viewer: [
    { title: 'Start with My tasks', what: 'Your follow-up is public tracking only. Viewer tasks never expose private candidate records.', next: 'Use a tracking code shared with you to open public progress.', href: '/viewer/tasks' },
    { title: 'Look up a candidate', what: 'Viewer access is read-only and depends on public tracking availability.', next: 'Enter a tracking code on the viewer dashboard.', href: '/viewer' },
    { title: 'Understand flags', what: 'A flag is a request to review a record, not a conclusion that someone did something wrong.', next: 'Share the candidate tracking code with an authorized staff member.', href: '/viewer' },
  ],
  admin: [
    { title: 'Start with My tasks', what: 'Review role-specific warnings and monitor staff workload. Only authorized managers can change assignments.', next: 'Open a task, check its evidence and save the permitted follow-up on the record.', href: '/admin/tasks' },
    ...commonSteps,
  ],
  agency: [
    { title: 'Start with My tasks and team workload', what: 'Agency follow-ups and staff assignments stay in your foreign agency.', next: 'Review current tasks and assign them to approved agency staff.', href: '/agency/tasks' },
    { title: 'Review money sent', what: 'Only your agency’s outbound receipts are available, without bank-audit tools.', next: 'Open a receipt and check the receiving agency and reference.', href: '/agency/payments' },
  ],
};

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Superadmin / ministry', admin: 'Administrator', agency: 'Foreign agency (legacy role)', staff: 'Local / internal staff', 'local-agency': 'Local agency manager', 'foreign-agency': 'Foreign agency manager',
  'foreign-agency-staff': 'Foreign agency staff', candidate: 'Candidate', auditor: 'Auditor', viewer: 'Viewer',
};

const roleDescriptions: Record<UserRole, string> = {
  superadmin: 'Reviews all agencies, manages accounts and fees, and makes ministry payment-case decisions. Candidate intake still comes from the ministry register.',
  admin: 'Reviews candidate records, payments, clearance and team progress. Account approvals, ministry decisions and system settings stay with the superadmin.',
  agency: 'Uses the foreign agency manager workspace for its candidates, contracts, transfers and staff. This older role name is still supported.',
  staff: 'Starts with assigned candidate tasks and records permitted stage updates or follow-ups. Cannot manage accounts, fees or ministry case decisions.',
  'local-agency': 'Manages its own candidate progress, received payments, local checks and approved staff. Other agencies’ private records are not part of this workspace.',
  'foreign-agency': 'Coordinates its candidates and contracts, sends payments to local agencies and assigns its own staff. Money sent shows outbound receipts, not bank-audit tools.',
  'foreign-agency-staff': 'Follows assigned work, reviews candidate introductions and tracks contract and clearance progress. Account management and transfers are handled by the agency manager.',
  candidate: 'Views their own progress, uploads requested documents and chats with the agency. Cannot assign staff, approve records or access another candidate’s files.',
  auditor: 'Reads record warnings, evidence and recorded exceptions. Cannot edit candidate records, assign staff or make agency decisions.',
  viewer: 'Looks up public progress with a shared tracking code. Cannot open private profiles, edit records or use payment tools.',
};

const manual = [
  ['Ministry intake and passport upload', 'Ministry, staff and administrators', 'Candidate intake must come through ELMIS with the responsible local agency and Labor ID. The official connection is pending. Passport image/PDF scanning attaches evidence to one existing matching candidate; no manual new record is created.'],
  ['Search and filters', 'Staff, administrators and agencies', 'Search by candidate details, and use available agency, batch and status filters to narrow the pipeline.'],
  ['Candidate profile', 'Staff and linked agencies', 'Open a candidate to review identity, contacts, agencies, introduction, journey and previous employment history.'],
  ['Stages and timeline', 'Staff and authorized agencies', 'Open Timeline Editor to record stage status, dates and references. The candidate tracking view displays progress.'],
  ['Documents', 'Staff and candidates', 'Upload requested files to the relevant stage; review screening warnings and use the document manager to inspect records.'],
  ['Medical results', 'Staff and administrators', 'Use Medical Results on the candidate record to record exam outcomes and dates.'],
  ['Contracts and introductions', 'Local and foreign agencies, staff', 'Review introductions, share a secure contract link and acknowledge its receipt in the candidate record.'],
  ['Visa and clearance', 'Local agencies, staff and administrators', 'Validate visa details and record local checks; final issuance depends on ministry confirmation. Foreign agencies can track clearance.'],
  ['Training and deployment maps', 'Staff, administrators and agencies', 'Filter by agency, phase, center or region where available; select a destination or candidate to inspect journeys.'],
  ['Return and reapplication', 'Staff, linked agencies and candidates', 'Review recorded previous journeys and return dates in the profile. A new application has its own current progression.'],
  ['Payments and receipts', 'Candidates, agencies, staff and administrators', 'Review payment status and receipts. Local agencies can compare settled transfers with an uploaded bank statement.'],
  ['My tasks and workload manager', 'All account roles', 'Start with role-specific follow-ups, open the underlying record and save your permitted action there. Managers assign or balance eligible staff in their scope. Staff follow their assigned stages and due dates. Auditors/viewers have read-only follow-ups; candidates only have document reminders. Assignment never skips payments or stages.'],
  ['Chat and notifications', 'Candidates, agencies, staff and administrators', 'Use the relevant inbox to follow conversations and notifications associated with candidate work.'],
  ['User management and authorization', 'Administrators and agency account managers', 'Review account approvals and manage authorized users and codes within the permissions of your workspace.'],
  ['Integrity and audit', 'Staff, administrators and auditors', 'Review findings and their supporting information. A warning calls for review and does not by itself establish misconduct.'],
  ['Attendance and presence', 'Staff and administrators', 'Review attendance sessions and recent presence in the staff workspace.'],
  ['Settings', 'Administrators', 'Manage configured agencies, CoC centers, fees, warning thresholds and demo scenarios.'],
  ['Demo scenario top menu', 'Demo superadmins', 'Select a card in Switch scenario to apply it immediately. No typed reason or extra confirmation is needed. Held cases and uploaded statements remain protected. Hidden in live mode.'],
  ['Public and candidate tracking', 'Candidates and viewers', 'Candidates sign in to their own tracking page. Viewers use a tracking code and see only what public tracking makes available.'],
];

const StakeholderGuide: React.FC = () => {
  const { userRole, candidateTrackingCode } = useAuth();
  const role = userRole ?? 'viewer';
  const steps = roleSteps[role];
  const [index, setIndex] = useState(0);
  const [manualQuery, setManualQuery] = useState('');
  useEffect(() => setIndex(0), [role]);
  const step = steps[index];
  const href = role === 'candidate' && candidateTrackingCode ? `/track/${candidateTrackingCode}` : role === 'local-agency' && step.href.startsWith('/admin') ? '/local-agency' : step.href;
  const progress = Math.round(((index + 1) / steps.length) * 100);
  const savedTour = readWalkthrough();
  const canResume = savedTour?.role === role && !savedTour.completed;
  const filteredManual = manual.filter(item => item.join(' ').toLowerCase().includes(manualQuery.trim().toLowerCase()));

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" asChild><Link to={role === 'candidate' && candidateTrackingCode ? `/track/${candidateTrackingCode}` : role === 'local-agency' ? '/local-agency' : role === 'agency' || role.startsWith('foreign-agency') ? '/agency' : role === 'viewer' ? '/viewer' : role === 'auditor' ? '/auditor' : '/admin'}><ArrowLeft className="mr-2 h-4 w-4" />Back to workspace</Link></Button>
        <span className="text-sm text-muted-foreground">{roleLabels[role]} guide</span>
      </div>
      <PageHeader title="Your work, made clear" description="Follow one task at a time with the interactive portal walkthrough." />
      <section className="space-y-2">
        <p className="rounded-xl border bg-muted/30 p-4 text-sm"><span className="font-semibold">{roleLabels[role]}: </span>{roleDescriptions[role]}</p>
        {isDemoMode() && <div className="flex flex-wrap gap-2 pt-2"><Button onClick={() => startWalkthrough(true)}>{canResume ? 'Resume portal walkthrough' : 'Start portal walkthrough'} <ArrowRight className="ml-2 h-4 w-4" /></Button>{canResume && <Button variant="outline" onClick={() => startWalkthrough(false)}>Start over</Button>}</div>}
      </section>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Step {index + 1} of {steps.length}</span><span>{progress}%</span></div>
        <Progress value={progress} className="h-2" />
      </div>
      <Card className="border-primary/40 ring-2 ring-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-primary" />{step.title}</CardTitle>
          <CardDescription>{step.what}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">What to do</p>
            <p className="mt-1 text-sm">{step.next}</p>
          </div>
          <Button asChild><Link to={href}>Open this feature <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map((item, stepIndex) => (
          <button key={item.title} type="button" onClick={() => setIndex(stepIndex)} className={`rounded-md border p-4 text-left transition-colors ${stepIndex === index ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
            <span className="flex items-center gap-2 text-sm font-medium">{stepIndex < index && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{stepIndex + 1}. {item.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{item.what}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}>Previous</Button>
        <Button disabled={index === steps.length - 1} onClick={() => setIndex(value => Math.min(steps.length - 1, value + 1))}>Next step <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
      <section className="space-y-4 border-t pt-6" aria-labelledby="manual-title">
        <div><h2 id="manual-title" className="text-xl font-semibold">Portal manual</h2><p className="text-sm text-muted-foreground">Roles, responsibilities and available functions</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(roleLabels) as UserRole[]).map(key => <div key={key} className="border-l-2 border-primary/30 pl-3 text-sm"><p className="font-medium">{roleLabels[key]}</p><p className="text-muted-foreground">{roleDescriptions[key]}</p></div>)}
        </div>
        <Input aria-label="Search the manual" placeholder="Search functions or roles" value={manualQuery} onChange={event => setManualQuery(event.target.value)} />
        <div className="divide-y border-y">
          {filteredManual.map(([title, roles, instructions]) => <details key={title} className="py-3"><summary className="cursor-pointer text-sm font-medium">{title}</summary><p className="mt-2 text-xs font-medium text-primary">{roles}</p><p className="mt-1 text-sm text-muted-foreground">{instructions}</p></details>)}
          {filteredManual.length === 0 && <p className="py-4 text-sm text-muted-foreground">No matching functions.</p>}
        </div>
      </section>
    </main>
  );
};

export default StakeholderGuide;
