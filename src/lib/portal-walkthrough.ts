import type { UserRole } from './types';

export interface WalkthroughStep { title: string; detail: string; path: string; selector: string; instructions: string[]; check: string }
export interface WalkthroughState { role: UserRole; index: number; active: boolean; completed: boolean; returnTo: string }

const KEY = 'dawm_demo_walkthrough';
export const readWalkthrough = (): WalkthroughState | null => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as WalkthroughState | null; } catch { return null; }
};
export const saveWalkthrough = (state: WalkthroughState) => sessionStorage.setItem(KEY, JSON.stringify(state));
export const startWalkthrough = (resume: boolean) => window.dispatchEvent(new CustomEvent('start-demo-walkthrough', { detail: { resume } }));

export const walkthroughSteps = (role: UserRole, trackingCode?: string | null, candidateId = 'demo-cand-0431'): WalkthroughStep[] => {
  const profile = `/admin/candidate/${encodeURIComponent(candidateId)}`;
  if (role === 'superadmin' || role === 'admin' || role === 'staff') return [
    { title: 'Choose the dashboard view', detail: 'Start with the agency whose work you want to review.', path: '/admin', selector: 'main h1',
      instructions: [role === 'superadmin' ? 'Choose a local agency in Dashboard view, or keep All local agencies.' : 'Review the dashboard information available to your account.', 'Read the candidate total and Record check score.'], check: 'The agency name, candidate count and score match the selected view.' },
    { title: 'Start with My tasks', detail: 'Follow your own work before reviewing the wider candidate pipeline.', path: '/admin/tasks', selector: '[data-tour="workload-manager"]',
      instructions: role === 'staff' ? ['Read your assigned tasks, due dates and payment blockers.', 'Open the earliest task and check the next required stage.', 'Record a follow-up on the candidate; do not skip an unpaid stage.']
        : ['Read My tasks for warnings, replies and approvals that your role can review.', 'Review work by staff member in Team workload.', role === 'superadmin' ? 'Choose an owner or balance work; the guide will not assign anything automatically.' : 'Follow up with the authorized manager when a task needs assigning.'],
      check: 'Task ownership does not grant extra permissions or complete a stage. Save the underlying record, not a checkbox in the queue.' },
    { title: 'Understand ministry intake', detail: 'Candidates must be registered and assigned by the ministry, not added by staff.', path: '/admin', selector: '[data-tour="registration"]',
      instructions: ['Read the ELMIS connection status.', 'Check the candidate’s local agency and Labor ID in the existing profile.', 'Passport upload can attach a scan to one matching existing candidate; no new record is created.'], check: 'The official API is pending. A practice identity check is not live ministry verification.' },
    { title: 'Review the candidate identity', detail: 'Follow one existing practice candidate through the next steps.', path: profile, selector: '[data-tour="candidate-profile"]',
      instructions: ['Read the name, tracking code and passport details.', 'Check the local agency and home city.'], check: 'Use the same candidate and tracking code when checking documents and receipts.' },
    { title: 'Check registration payment', detail: 'Registration must be paid and completed before Training starts.', path: `${profile}?tab=payments`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Find the Registration fee and its receipt.', 'Check the paid amount and payment status.'], check: 'If money is missing or only partly paid, await payment; do not advance Training.' },
    { title: 'Follow the stages in order', detail: 'Registration → Training → Medical Check → Deployment.', path: `${profile}?tab=timeline`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Find the earliest unfinished stage.', 'Read its payment or document blockers.', 'Check that later stages are still waiting.'], check: 'A completed earlier stage needs its own fee covered. This guide never completes a stage for you.' },
    { title: 'Check training documents', detail: 'Keep required evidence linked to the correct candidate and stage.', path: `${profile}?tab=documents`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Review each requested file and its stage.', 'Read any document screening warnings before accepting a file.'], check: 'Missing documents are still requested; a warning is not automatically cleared.' },
    { title: 'Review medical checks', detail: 'All required exams need saved passing results and the medical fee must be paid.', path: `${profile}?tab=medical`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Review HIV and Final Agency Medical; review Pregnancy when required.', 'Check exam dates and any failed or missing result.'], check: 'One passing exam is not enough to complete Medical Check. Failed pregnancy blocks flight booking.' },
    { title: 'Review the contract and visa', detail: 'Travel preparation must not bypass essential records.', path: `${profile}?tab=contract`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Read the employer, destination and contract status.', 'Check visa details and expiry.'], check: 'Practice documents are not legally valid visas or official clearance.' },
    { title: 'Compare foreign transfers with bank records', detail: 'Contract amounts and bank differences are separate checks.', path: '/admin/payments?tab=discrepancies&source=foreign', selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Review the foreign-to-local contract checks.', 'Scroll to bank comparisons for each receiving local agency.', 'Open a short payment, extra amount or missing entry to inspect the candidate and reference.'], check: 'An amount/date suggestion is not a confirmed reference match. A warning does not prove agency fault.' },
    { title: 'Follow a payment issue', detail: 'Review → agency reply → recorded decision or appeal.', path: '/admin/payments?tab=resolution', selector: 'main h1',
      instructions: ['Open Payment issues and choose a case.', 'Read its candidate, amounts, reply deadline and decision history.'], check: 'Only authorized reviewers make decisions. Appeals do not automatically lift a pause; the guide never changes a case.' },
    { title: 'Review clearance before departure', detail: 'Official ministry confirmation is required before completing deployment.', path: '/admin/clearance', selector: 'main h1',
      instructions: ['Find the candidate and read the clearance checklist.', 'Check visa, flight details and ministry QR requirements.'], check: 'A practice confirmation cannot unlock official departure.' },
    { title: 'Follow journeys and returns', detail: 'Previous journeys remain available for later applications.', path: '/admin/training-map', selector: '[data-tour="network-map"]',
      instructions: ['Choose a region or CoC center on the map.', 'Open a candidate route to inspect the journey.'], check: 'A new application keeps its own ordered stages; old deployment history does not skip them.' },
  ].filter(step => role === 'superadmin' || step.path !== '/admin/payments?tab=resolution');
  if (role === 'local-agency') return [
    { title: 'Find your agency’s candidates', detail: 'Review only your agency’s records.', path: '/local-agency', selector: 'main h1', instructions: ['Review the candidate total.', 'Open a candidate and find the earliest unfinished stage.'], check: 'Unpaid registration must wait before Training can start.' },
    { title: 'Review My tasks and manage workload', detail: 'Your agency’s follow-ups and staff assignments stay together.', path: '/local-agency/tasks', selector: '[data-tour="workload-manager"]',
      instructions: ['Read My tasks for record warnings, replies and contract receipt checks.', 'Review work by staff member; assign a current task or use Balance agency work.', 'Open a task and record a follow-up on the candidate.'], check: 'Only approved staff from your own agency receive tasks; other agencies and paid stages are unchanged.' },
    { title: 'Check received payments', detail: 'Compare receipts with the receiving bank account.', path: '/local-agency/payments?tab=discrepancies&source=foreign', selector: 'main h1', instructions: ['Choose Foreign → local.', 'Review short, extra and missing bank entries.', 'Check candidate identity and transfer reference.'], check: 'Contract expectations and bank proof are different checks.' },
    { title: 'Review clearance', detail: 'Follow required medical, visa and ministry checks.', path: '/local-agency/clearance', selector: 'main h1', instructions: ['Find a candidate.', 'Read every unfinished clearance requirement.'], check: 'Do not book departure as complete without the required official confirmation.' },
    { title: 'Follow candidate journeys', detail: 'Review training routes and destinations.', path: '/local-agency/training-map', selector: '[data-tour="network-map"]', instructions: ['Choose a region or center.', 'Open a candidate route.'], check: 'The selected journey belongs to your agency.' },
  ];
  if (role === 'agency' || role === 'foreign-agency' || role === 'foreign-agency-staff') return [
    { title: 'Find your agency’s candidates', detail: 'Review linked candidates and their current stages.', path: '/agency', selector: 'main h1', instructions: ['Review the agency candidate list.', 'Open a profile to check its name and tracking code.'], check: 'Candidates awaiting payment must not skip earlier stages.' },
    { title: role === 'foreign-agency-staff' ? 'Review your assigned work' : 'Assign agency work', detail: 'Follow current tasks without changing local stage ownership.', path: '/agency/tasks', selector: 'main h1',
      instructions: role === 'foreign-agency-staff' ? ['Read the tasks assigned to you.', 'Open the candidate and follow up on payment blockers and missing details.'] : ['Read My tasks for contract and agency-reply follow-ups.', 'Read Work by staff member.', 'Assign a current task, or use Balance agency work.'], check: 'Only approved staff in this agency receive work; awaiting payment remains a blocker.' },
    { title: 'Review candidate introductions', detail: 'Check introductions before coordinating a contract.', path: '/agency/introductions', selector: 'main h1', instructions: ['Open a candidate introduction.', 'Compare it with the candidate profile.'], check: 'Use the candidate’s tracking code when coordinating the contract.' },
    { title: 'Review money sent', detail: 'Your outbound receipts only, without bank-audit tools.', path: '/agency/payments?tab=ledger', selector: 'main h1', instructions: ['Open a receipt.', 'Check the receiving local agency, amount, currency and reference.'], check: 'These are your agency’s transfers, not candidate fees or another agency’s receipts.' },
    { title: 'Follow clearance', detail: 'Track requirements without bypassing local processing.', path: '/agency/clearance', selector: 'main h1', instructions: ['Find a candidate.', 'Read outstanding visa and clearance requirements.'], check: 'Only official confirmation can complete the ministry requirement.' },
  ];
  if (role === 'candidate' && trackingCode) return [
    { title: 'Review your next step', detail: 'Your own stages and next actions.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="candidate-journey"]', instructions: ['Find your current stage and any payment request.', 'Review required documents and messages.'], check: 'Do not pay against another person’s tracking code or receipt.' },
    { title: 'Read your document reminders', detail: 'Helpful suggestions only, not staff assignments.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="my-tasks"]', instructions: ['Read any document reminder for your current stage.', 'Ask your agency which document is needed.', 'Open documents and upload the requested file to that stage.'], check: 'A document upload needs agency review; it does not complete a stage or confirm payment.' },
  ];
  if (role === 'auditor') return [
    { title: 'Start with My tasks', detail: 'Your read-only review queue.', path: '/auditor/tasks', selector: '[data-tour="my-tasks"]', instructions: ['Start with the highest-priority warning.', 'Open the review record and check its evidence.'], check: 'You can review records but cannot assign staff or make agency decisions.' },
    { title: 'Review recorded warnings', detail: 'Read-only evidence review.', path: '/auditor', selector: 'main h1', instructions: ['Choose an issue and read the supporting records.', 'Review accepted exceptions and their recorded reasons.'], check: 'Warnings call for review; they are not proof of wrongdoing.' },
  ];
  return [
    { title: 'Start with My tasks', detail: 'Read-only tracking follow-up.', path: '/viewer/tasks', selector: '[data-tour="my-tasks"]', instructions: ['Read the tracking follow-up.', 'Use a tracking code shared with you to open public progress.'], check: 'No private records, staff assignments or payment tools are available to a viewer.' },
    { title: 'Track a candidate', detail: 'Open the available public tracking view.', path: '/viewer', selector: 'main h1', instructions: ['Enter a tracking code.', 'Review the public status information.'], check: 'Private candidate and payment details require authorized access.' },
  ];
};