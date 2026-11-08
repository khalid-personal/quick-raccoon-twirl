import type { UserRole } from './types';

export interface WalkthroughStep { title: string; detail: string; path: string; selector: string; instructions: string[]; instructionSelectors?: string[]; check: string }
export interface WalkthroughState { role: UserRole; index: number; subIndex?: number; active: boolean; completed: boolean; returnTo: string }

const KEY = 'dawm_demo_walkthrough';
export const readWalkthrough = (): WalkthroughState | null => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as WalkthroughState | null; } catch { return null; }
};
export const saveWalkthrough = (state: WalkthroughState) => sessionStorage.setItem(KEY, JSON.stringify(state));
export const startWalkthrough = (resume: boolean) => window.dispatchEvent(new CustomEvent('start-demo-walkthrough', { detail: { resume } }));

const dashboardSteps = (role: UserRole, path = '/admin'): WalkthroughStep[] => [
  { title: 'Dashboard · Overview', detail: 'Understand today’s work before leaving the dashboard.', path: `${path}?section=overview`, selector: '[data-tour="dashboard-overview"]',
    instructions: ['Overview is the first dashboard menu. Read today’s work, then move through each dashboard menu in order.',
      'Use the executive totals and status cards to understand the current candidate pipeline. Open a total to inspect its records.',
      ...(role !== 'local-agency' ? ['Read the Record check score and its warnings. The selected agency has its own score; a healthy score is not official clearance.'] : []),
      ...(role === 'superadmin' ? ['Review Payment issues: new foreign-transfer differences, waiting replies, paused agencies and appeals. Candidate payment failures are not agency discrepancies.'] : []),
      'Read the live roster. Open a person’s profile to see their role and current availability; presence does not mean a task is complete.'],
    instructionSelectors: ['[role="tab"][aria-label="Overview"]', '[data-tour="dash-overview-executive"]',
      ...(role !== 'local-agency' ? ['[data-tour="dash-overview-integrity"]'] : []),
      ...(role === 'superadmin' ? ['[data-tour="dash-overview-resolution"]'] : []), '[data-tour="dash-overview-presence"]'],
    check: 'You understand candidate totals, record warnings and live presence for the selected agency. Next is Workforce, not My tasks.' },
  { title: 'Dashboard · Workforce', detail: 'Learn people, journeys and working-abroad information.', path: `${path}?section=portfolio`, selector: '[data-tour="dashboard-workforce"]',
    instructions: ['Workforce is the second dashboard menu. It describes the candidate portfolio rather than assigning staff tasks.',
      'Read Candidate journeys: locate candidates at registration, training, medical and deployment. Open a group to inspect its people.',
      'Review Working abroad: check deployed workers, destinations and employment/return information. Earlier stages still require their own payment and evidence.',
      'Use Candidate backgrounds to understand occupations, cities and regions. Charts describe the selected agency, not every agency.',
      ...(role === 'local-agency' ? ['Review Partner contracts for your agency before coordinating work with a foreign partner.'] : [])],
    instructionSelectors: ['[role="tab"][aria-label="Workforce"]', '[data-tour="dash-portfolio-lifecycle"]', '[data-tour="dash-portfolio-workforce"]', '[data-tour="dash-portfolio-mix"]',
      ...(role === 'local-agency' ? ['[data-tour="dash-portfolio-partners"]'] : [])],
    check: 'You can distinguish the journey pipeline, working-abroad workforce and candidate backgrounds. Payments is next.' },
  { title: 'Dashboard · Payments', detail: 'Separate candidate fee collections from foreign-to-local transfers.', path: `${path}?section=finance`, selector: '[data-tour="dashboard-payments"]',
    instructions: ['Payments is the third dashboard menu. Read the financial overview for the agency selected in Dashboard view.',
      'Check candidate collections and receipts. Only successful linked receipts cover fees; failed, timed-out or missing payments leave the stage unpaid.',
      'Check foreign agency transfer totals separately. Preserve original currency; any USD estimate is not a bank-confirmed conversion.',
      'Find Review foreign agency transfers. This opens receipt/reference and bank checks for the sending foreign agency; the detailed transfer review is taught later.'],
    instructionSelectors: ['[role="tab"][aria-label="Payments"]', '[data-tour="dash-finance-finance"]', '[data-tour="dash-finance-finance"]', '[data-tour="dashboard-transfer-review"]'],
    check: 'Candidate ChechePay status and foreign bank discrepancies are different workflows. Continue to Document checks before leaving the dashboard.' },
  { title: 'Dashboard · Document checks', detail: 'Understand contract requirements, transfer compliance and deadlines.', path: `${path}?section=compliance`, selector: '[data-tour="dashboard-documents"]',
    instructions: ['Document checks is the fourth dashboard menu. It brings together contract and compliance information.',
      'Read Foreign to local payment compliance. A sent work contract requires a receipt from the responsible foreign agency; missing payment needs follow-up.',
      'Inspect the comparison’s candidate, sender, recipient, contract currency and expected amount. A contract estimate alone cannot consume an underpayment chance.',
      'Review Contracts ending soon. Open the worker’s profile to check the actual contract dates and follow-up instead of assuming renewal.',
      'Required candidate files are reviewed in each candidate’s Documents tab. Missing documents or ministry clearance must not be skipped to deploy faster.'],
    instructionSelectors: ['[role="tab"][aria-label="Document checks"]', '[data-tour="dash-compliance-foreign-payment-compliance"]', '[data-tour="dash-compliance-foreign-payment-compliance"]', '[data-tour="dash-compliance-expiring"]', '[data-tour="dashboard-documents"]'],
    check: 'You can find contract-payment blockers and expiry follow-up. Candidates is the last dashboard menu.' },
  { title: 'Dashboard · Candidates', detail: 'Learn search, filters, status summaries and profile shortcuts.', path: `${path}?section=candidates`, selector: '[data-tour="dashboard-candidates"]',
    instructions: ['Candidates is the fifth dashboard menu. These are ministry-managed records; staff must not add duplicates.',
      'Use name, passport or tracking-code search, then batch and status filters. Authorized agency filters further narrow the list without changing the records.',
      'Choose a status summary to filter the list; choose it again or clear the filter to restore the list. Sort columns to find the right candidate.',
      'Read each row’s portrait, identity, stage progress and record-check warnings. Open Profile or View passport to inspect the existing candidate.',
      'Keep the tracking code when reviewing documents, receipts and chats. You have now visited all five dashboard menus; next we teach My tasks and staff workload.'],
    instructionSelectors: ['[role="tab"][aria-label="Candidates"]', '[data-tour="dash-candidates-filters"]', '[data-tour="dash-candidates-candidates"]', '[data-tour="dash-candidates-candidates"]', '[data-tour="dash-candidates-candidates"]'],
    check: 'You can find a candidate and open the right evidence without altering identity or bypassing stages.' },
];

export const walkthroughSteps = (role: UserRole, trackingCode?: string | null, candidateId = 'demo-cand-0431'): WalkthroughStep[] => {
  const profile = `/admin/candidate/${encodeURIComponent(candidateId)}`;
  if (role === 'superadmin' || role === 'admin' || role === 'staff') return [
    { title: 'Choose the dashboard view', detail: 'First choose whose dashboard you are learning.', path: '/admin?section=overview', selector: '[aria-label="Dashboard sections"]',
      instructions: [role === 'superadmin' ? 'Choose a local agency in Dashboard view, or keep All local agencies.' : 'Review the dashboard information available to your account.', 'The dashboard has five menus: Overview, Workforce, Payments, Document checks and Candidates. We will teach each one before My tasks.'],
      instructionSelectors: [role === 'superadmin' ? '[data-tour="dashboard-agency-scope"]' : '[aria-label="Dashboard sections"]', '[aria-label="Dashboard sections"]'],
      check: 'The selected agency scopes the dashboard. Next, learn Overview and its functions.' },
    ...dashboardSteps(role),
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
      instructions: ['Read the employer, destination and contract status.', 'After the contract is sent, check for a successful foreign-to-local receipt.', 'If it is missing or short, follow up with the responsible foreign agency.', 'Check visa details and expiry.'], check: 'No receipt means unpaid. Contract transfers are separate from candidate stage fees.' },
    { title: 'Compare foreign transfers with bank records', detail: 'Contract amounts and bank differences are separate checks.', path: '/admin/payments?tab=discrepancies&source=foreign', selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Review the foreign-to-local contract checks.', 'Scroll to bank comparisons for each receiving local agency.', 'Open a short payment, extra amount or missing entry to inspect the candidate and reference.'], check: 'An amount/date suggestion is not a confirmed reference match. A warning does not prove agency fault.' },
    { title: 'Follow a payment issue', detail: 'Review → agency reply → recorded decision or appeal.', path: '/admin/payments?tab=resolution', selector: 'main h1',
      instructions: ['Open Payment issues and choose a foreign-to-local transfer case.', 'Match the candidate tracking code, transfer reference, currency and bank credit before confirming an underpayment.', 'Read the foreign agency’s remaining chances. The third distinct verified underpayment in the current cycle pauses new operations.', 'Check the ministry renewal date in the countdown; renewal restores chances but never lifts an active pause.', 'Read the reply deadline, agency appeal and recorded ministry decision. A release preserves used chances until the renewal date.'], check: 'Only authorized reviewers make decisions. Candidate ChechePay failures are payment statuses, not agency discrepancies. The guide never changes a case.' },
    { title: 'Review clearance before departure', detail: 'Official ministry confirmation is required before completing deployment.', path: '/admin/clearance', selector: 'main h1',
      instructions: ['Find the candidate and read the clearance checklist.', 'Check visa, flight details and ministry QR requirements.'], check: 'A practice confirmation cannot unlock official departure.' },
    { title: 'Follow journeys and returns', detail: 'Previous journeys remain available for later applications.', path: '/admin/training-map', selector: '[data-tour="network-map"]',
      instructions: ['Choose a region or CoC center on the map.', 'Open a candidate route to inspect the journey.'], check: 'A new application keeps its own ordered stages; old deployment history does not skip them.' },
    { title: 'Open candidate conversations', detail: 'Chat is available from the floating icon, not the sidebar.', path: '/admin/tasks', selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Choose an existing thread or New chat.', 'Search for a candidate, open the conversation and check the tracking code before sending.'], check: 'Only candidates available to your account appear. Sending a message does not complete a task or stage.' },
  ].filter(step => role === 'superadmin' || step.path !== '/admin/payments?tab=resolution');
  if (role === 'local-agency') return [
    ...dashboardSteps(role, '/local-agency'),
    { title: 'Review My tasks and manage workload', detail: 'Your agency’s follow-ups and staff assignments stay together.', path: '/local-agency/tasks', selector: '[data-tour="workload-manager"]',
      instructions: ['Read My tasks for record warnings, replies and contract receipt checks.', 'Review work by staff member; assign a current task or use Balance agency work.', 'Open a task and record a follow-up on the candidate.'], check: 'Only approved staff from your own agency receive tasks; other agencies and paid stages are unchanged.' },
    { title: 'Check received payments', detail: 'Compare receipts with the receiving bank account.', path: '/local-agency/payments?tab=discrepancies&source=foreign', selector: 'main h1', instructions: ['Choose Foreign → local.', 'Review short, extra and missing bank entries.', 'Check candidate identity and transfer reference.'], check: 'Contract expectations and bank proof are different checks.' },
    { title: 'Review clearance', detail: 'Follow required medical, visa and ministry checks.', path: '/local-agency/clearance', selector: 'main h1', instructions: ['Find a candidate.', 'Read every unfinished clearance requirement.'], check: 'Do not book departure as complete without the required official confirmation.' },
    { title: 'Follow candidate journeys', detail: 'Review training routes and destinations.', path: '/local-agency/training-map', selector: '[data-tour="network-map"]', instructions: ['Choose a region or center.', 'Open a candidate route.'], check: 'The selected journey belongs to your agency.' },
    { title: 'Open candidate conversations', detail: 'Use the floating chat icon on any page.', path: '/local-agency/tasks', selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Choose an existing thread or New chat.', 'Search and open a candidate conversation.'], check: 'Only candidates in your agency appear.' },
  ];
  if (role === 'agency' || role === 'foreign-agency' || role === 'foreign-agency-staff') return [
    { title: 'Find your agency’s candidates', detail: 'Review linked candidates and their current stages.', path: '/agency', selector: 'main h1', instructions: ['Review the agency candidate list.', 'Open a profile to check its name and tracking code.'], check: 'Candidates awaiting payment must not skip earlier stages.' },
    { title: role === 'foreign-agency-staff' ? 'Review your assigned work' : 'Assign agency work', detail: 'Follow current tasks without changing local stage ownership.', path: '/agency/tasks', selector: 'main h1',
      instructions: role === 'foreign-agency-staff' ? ['Read the tasks assigned to you.', 'Open the candidate and follow up on payment blockers and missing details.'] : ['Read My tasks for contract and agency-reply follow-ups.', 'Read Work by staff member.', 'Assign a current task, or use Balance agency work.'], check: 'Only approved staff in this agency receive work; awaiting payment remains a blocker.' },
    { title: 'Review candidate introductions', detail: 'Check introductions before coordinating a contract.', path: '/agency/introductions', selector: 'main h1', instructions: ['Open a candidate introduction.', 'Compare it with the candidate profile.'], check: 'Use the candidate’s tracking code when coordinating the contract.' },
    { title: 'Make payment after the contract is sent', detail: 'The responsible foreign agency pays the receiving local agency next.', path: '/agency/tasks', selector: 'main h1', instructions: ['Find Make contract payment in My tasks.', 'Open the candidate Payments tab.', role === 'foreign-agency-staff' ? 'Ask your agency manager to make the transfer, then follow up on its receipt.' : 'Choose Make payment for this candidate and check the amount, currency and receiving agency.', 'Return to Money sent to check the successful receipt.'], check: 'Missing, pending or short receipts keep payment open. This transfer does not pay the candidate’s stage fees.' },
    { title: 'Review money sent', detail: 'Your outbound receipts only, without bank-audit tools.', path: '/agency/payments?tab=ledger', selector: 'main h1', instructions: ['Open a receipt.', 'Check the receiving local agency, amount, currency and reference.'], check: 'These are your agency’s transfers, not candidate fees or another agency’s receipts.' },
    { title: 'Follow clearance', detail: 'Track requirements without bypassing local processing.', path: '/agency/clearance', selector: 'main h1', instructions: ['Find a candidate.', 'Read outstanding visa and clearance requirements.'], check: 'Only official confirmation can complete the ministry requirement.' },
    { title: 'Open candidate conversations', detail: 'Use the floating chat icon on any page.', path: '/agency/tasks', selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Choose an existing thread or New chat.', 'Search and open a candidate conversation.'], check: 'Check the candidate and tracking code before sending a message.' },
  ];
  if (role === 'candidate' && trackingCode) return [
    { title: 'Review your next step', detail: 'Your own stages and next actions.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="candidate-journey"]', instructions: ['Find your current stage and any payment request.', 'Review required documents and messages.'], check: 'Do not pay against another person’s tracking code or receipt.' },
    { title: 'Read your document reminders', detail: 'Helpful suggestions only, not staff assignments.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="my-tasks"]', instructions: ['Read any document reminder for your current stage.', 'Ask your agency which document is needed.', 'Open documents and upload the requested file to that stage.'], check: 'A document upload needs agency review; it does not complete a stage or confirm payment.' },
    { title: 'Contact your agency', detail: 'Your conversation stays attached to your own profile.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Open your thread or choose New chat.', 'Send your question or tag the document you need help with.'], check: 'You cannot open another candidate’s conversations.' },
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