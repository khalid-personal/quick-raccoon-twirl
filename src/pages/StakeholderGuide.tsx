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
    { title: 'Balance staff work', what: 'Open tasks are created from each candidate’s next unfinished stage. Equal workload is the default.', next: 'Set a staff weight, then apply the workload settings.', href: '/admin/tasks' },
    { title: 'Review record warnings', what: 'Warnings show records that need a closer look. Correct the missing or conflicting details rather than hiding the warning.', next: 'Open Record checks and start with urgent issues.', href: '/admin/integrity' },
    { title: 'Practice with demo records', what: 'Six examples show different numbers of record and payment problems while keeping the same candidates.', next: 'Open Settings and choose a demo practice example.', href: '/admin/settings' },
    { title: 'Review online staff', what: 'The green dot means the account was recently active. Recorded attendance begins at sign-in and ends at logout.', next: 'Review the staff list or attendance history.', href: '/admin/users' },
    { title: 'Manage access and fees', what: 'Approved accounts determine who can enter each workspace. Stage fees are shown to candidates before payment.', next: 'Review staff approvals, agency access, and stage fees.', href: '/admin/settings' },
    { title: 'Review payments', what: 'Payment records link the candidate, stage, amount, and receipt reference.', next: 'Check payment status and open a receipt when a payment is confirmed.', href: '/admin/payments' },
    { title: 'Read system messages', what: 'Candidate chats, notifications, and audit entries help your team coordinate and trace decisions.', next: 'Open the relevant inbox or notification list.', href: '/admin/chat' },
    ...commonSteps,
  ],
  staff: [
    { title: 'Start with My Tasks', what: 'Your queue lists the next stage or follow-up assigned to you, with due dates and the candidate’s progress.', next: 'Open a task, contact the candidate, and record the next action.', href: '/admin/tasks' },
    { title: 'Update the stage', what: 'Stage updates are shared with the candidate and the linked agencies.', next: 'Set the status, date, and next follow-up in the timeline editor.', href: '/admin' },
    { title: 'Check flagged records', what: 'File and workflow warnings help you find mismatches and records that may be off track.', next: 'Review the finding and update the underlying record.', href: '/admin/integrity' },
    { title: 'Attendance is automatic', what: 'Your work session begins when you sign in and ends when you log out.', next: 'Use Log out when you finish for the day.', href: '/admin/attendance' },
    { title: 'Keep in touch', what: 'Candidate chat and notifications keep follow-ups attached to the candidate workflow.', next: 'Open your inbox and record the next action on the task.', href: '/admin/chat' },
  ],
  'local-agency': [
    { title: 'Review candidate progress', what: 'The dashboard summarizes each stage and lists blocked, flagged, or inactive candidate files.', next: 'Open the candidate row to review the next step.', href: '/local-agency' },
    { title: 'Confirm received contracts', what: 'The foreign agency shares a secure contract link. Your agency confirms once the contract has arrived.', next: 'Open the candidate profile and mark the contract received.', href: '/local-agency' },
    { title: 'Prepare clearance', what: 'Visa, Enjaz, and Tasheer checks show what remains before ministry issuance.', next: 'Complete local checks and wait for the official ministry QR.', href: '/local-agency/clearance' },
    { title: 'Review payments and messages', what: 'Candidate fees, receipts, and chat stay linked to your agency’s candidate records.', next: 'Open payments to review receipts, or chat to reply to a candidate.', href: '/local-agency/payments' },
    ...commonSteps,
  ],
  'foreign-agency': [
    { title: 'Review candidate introductions', what: 'Candidate summaries, skills, languages, and introduction videos help you review a profile before sending a contract.', next: 'Open a candidate from your agency dashboard.', href: '/agency' },
    { title: 'Send a contract link', what: 'Share a secure HTTPS link with the candidate’s linked Ethiopian agency. The other agency confirms receipt.', next: 'Open the candidate viewer and send the contract link.', href: '/agency' },
    { title: 'Track clearance', what: 'The tracker shows local checks and whether the Labour Ministry certificate has been issued.', next: 'Review the candidate’s clearance status.', href: '/agency/clearance' },
    { title: 'Review payments and messages', what: 'Your agency’s payments, receipt references, and candidate conversations stay in one workspace.', next: 'Open payments to follow a receipt, or chat to coordinate a candidate.', href: '/agency/payments' },
  ],
  'foreign-agency-staff': [
    { title: 'Review candidate introductions', what: 'Candidate summaries, skills, languages, and introduction videos help you review a profile before sending a contract.', next: 'Open a candidate from your agency dashboard.', href: '/agency' },
    { title: 'Track a contract', what: 'The foreign agency shares a secure contract link; the linked Ethiopian agency marks it received.', next: 'Open the candidate viewer to check the handoff.', href: '/agency' },
    { title: 'Follow clearance', what: 'See visa and clearance progress for candidates linked to your agency.', next: 'Open the clearance tracker.', href: '/agency/clearance' },
    { title: 'Coordinate candidate follow-up', what: 'Use chat and the candidate timeline to keep agency communication connected to the file.', next: 'Open candidate chat or review payments.', href: '/agency/chat' },
  ],
  candidate: [
    { title: 'Check your journey', what: 'Your timeline shows each step and its current status.', next: 'Open the next stage and read any action requested by your agency.', href: '/track' },
    { title: 'Share documents safely', what: 'Uploads are screened for common file risks. A review message means the agency should check the file.', next: 'Choose the stage and upload the requested document.', href: '/track' },
    { title: 'View your profile', what: 'Your photo, introduction, and recorded progress help your agencies work from one current profile.', next: 'Ask your local agency to correct anything that is out of date.', href: '/track' },
    { title: 'Contact your agency', what: 'Use candidate chat for a question about a stage, document, payment, or follow-up.', next: 'Open chat from your tracking page.', href: '/track' },
  ],
  auditor: [
    { title: 'Review record warnings', what: 'Checks look for missing or conflicting candidate, stage, payment and document details.', next: 'Review the supporting records and activity history for each issue.', href: '/auditor' },
    { title: 'Understand review findings', what: 'A finding identifies a record that needs review; it is not a conclusion of wrongdoing.', next: 'Inspect the evidence available in the integrity workspace.', href: '/auditor' },
  ],
  viewer: [
    { title: 'Look up a candidate', what: 'Viewer access is read-only and depends on public tracking availability.', next: 'Enter a tracking code on the viewer dashboard.', href: '/viewer' },
    { title: 'Understand flags', what: 'A flag is a request to review a record, not a conclusion that someone did something wrong.', next: 'Share the candidate tracking code with an authorized staff member.', href: '/viewer' },
  ],
};

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Administrator', staff: 'Staff', 'local-agency': 'Ethiopian agency', 'foreign-agency': 'Foreign agency',
  'foreign-agency-staff': 'Foreign agency staff', candidate: 'Candidate', auditor: 'Auditor', viewer: 'Viewer',
};

const roleDescriptions: Record<UserRole, string> = {
  superadmin: 'Manages system settings, access, candidates and operations.',
  staff: 'Works candidate files, tasks, stages, payments and operational follow-up.',
  'local-agency': 'Manages its candidate pipeline, local checks, payments and agency staff.',
  'foreign-agency': 'Reviews its candidates, contracts, deployment and agency staff.',
  'foreign-agency-staff': 'Works within the foreign agency workspace using the permissions assigned to the account.',
  candidate: 'Views their own progress and uses available uploads and chat.',
  auditor: 'Reviews integrity findings and evidence in the audit workspace.',
  viewer: 'Uses a tracking code for the available read-only public tracking view.',
};

const manual = [
  ['Registration', 'Staff and administrators', 'Use Add New Candidate or passport upload; review identity, contact, agency and tracking details before creating the record.'],
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
  ['Tasks and assignments', 'Staff and administrators', 'Open My Tasks for assigned follow-up; administrators can configure workload allocation.'],
  ['Chat and notifications', 'Candidates, agencies, staff and administrators', 'Use the relevant inbox to follow conversations and notifications associated with candidate work.'],
  ['User management and authorization', 'Administrators and agency account managers', 'Review account approvals and manage authorized users and codes within the permissions of your workspace.'],
  ['Integrity and audit', 'Staff, administrators and auditors', 'Review findings and their supporting information. A warning calls for review and does not by itself establish misconduct.'],
  ['Attendance and presence', 'Staff and administrators', 'Review attendance sessions and recent presence in the staff workspace.'],
  ['Settings', 'Administrators', 'Manage configured agencies, CoC centers, fees, warning thresholds and demo scenarios.'],
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
        <Button variant="ghost" asChild><Link to={role === 'candidate' && candidateTrackingCode ? `/track/${candidateTrackingCode}` : role === 'local-agency' ? '/local-agency' : role.startsWith('foreign-agency') ? '/agency' : role === 'viewer' ? '/viewer' : role === 'auditor' ? '/auditor' : '/admin'}><ArrowLeft className="mr-2 h-4 w-4" />Back to workspace</Link></Button>
        <span className="text-sm text-muted-foreground">{roleLabels[role]} guide</span>
      </div>
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><BookOpen className="h-4 w-4" />Getting started</p>
        <h1 className="text-3xl font-semibold">Your work, made clear</h1>
        <p className="max-w-2xl text-muted-foreground">A short walkthrough of the tools available for your role. Choose a step to open the feature.</p>
        {isDemoMode() && <div className="flex flex-wrap gap-2 pt-2"><Button onClick={() => startWalkthrough(true)}>{canResume ? 'Resume portal walkthrough' : 'Start portal walkthrough'} <ArrowRight className="ml-2 h-4 w-4" /></Button>{canResume && <Button variant="outline" onClick={() => startWalkthrough(false)}>Start over</Button>}</div>}
      </header>
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
