import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import React from 'react';
import { CardTitle } from '@/components/ui/card';

const HELP: Array<{ match: RegExp; text: string }> = [
  { match: /^money sent$/i, text: 'Open an outbound receipt to see which local agency received your transfer, the candidate, transaction ID, amount and currency. This page shows only your foreign agency’s transfers. Candidate fees and bank-audit tools are not part of this view.' },
  { match: /^payments received$/i, text: 'Review candidate fees and foreign-agency transfers received by your local agency. Open a receipt to check the candidate and amount. Bank comparisons apply to foreign-agency transfers, not candidate ChechePay fees.' },
  { match: /^staff accounts$/i, text: 'Agency managers review and manage their own staff accounts here. My tasks & team is where you assign candidate work. Staff accounts controls access; assigning a task does not approve an account.' },
  { match: /^document checks$/i, text: 'Find sent contracts without a covering payment and contracts ending soon. Open the candidate profile to check the contract dates or Documents tab to read an individual file. This summary does not approve a document or authorize departure.' },
  { match: /sign-up codes/i, text: 'Superadmins issue time-limited codes for staff registration here. A code is not an account password. Review the account request in User management before granting access.' },
  { match: /^overview$/i, text: 'Read candidate totals, record warnings and recent activity. Select a total or warning to open the related records. Use My tasks for actions assigned to your role, and Workforce for candidate journeys.' },
  { match: /^workforce$/i, text: 'See people at each stage, working abroad or returned home. Select a chart group to inspect its candidates. Staff assignments are in My tasks & team, not in this summary.' },
  { match: /receipt|payment evidence|discrepanc|bank statement|reconciliation|payment issues/i, text: 'Compare the receipt with the bank deposit. Check the transfer reference, amount, date and currency. If something differs, ask for the missing proof or send the issue for review. Saving a note does not send a message or change the payment status.' },
  { match: /payment|finance|collection/i, text: 'Candidate fees and foreign-agency transfers are shown separately. Open a receipt to check the candidate, amount, currency and payment status. Candidate fees use ChechePay status; foreign transfers have separate bank comparisons.' },
  { match: /passport|registration|add new candidate/i, text: 'Candidate intake is ministry-managed through ELMIS; the official connection is pending. Passport scanning still reads image/PDF details and attaches them to one matching existing profile. It never creates another candidate or overwrites the original identity. Differences remain review warnings.' },
  { match: /medical/i, text: 'Review ministry-supplied exam results, dates and facility locations. Results and stage progress are read-only; use supporting documents and follow-up tasks for discrepancies.' },
  { match: /integrity|compliance|anti-corruption|record checks/i, text: 'Review records with missing payments, repeated identity details or unfinished checks. A warning means the record needs a closer look; it does not prove fraud. Only an authorized reviewer can accept an exception, and must record why.' },
  { match: /clearance|visa|enjaz|tasheer|ministry|qr/i, text: 'Follow visa, Enjaz, Tasheer and QR reference numbers received from the ministry. Statuses are read-only. Issued documents stay with the ministry.' },
  { match: /portfolio|lifecycle|working abroad|workforce|mix/i, text: 'See candidates who are preparing to leave, working abroad or back home. Selecting an agency shows only its candidates. Employment history and the four application stages are shown separately.' },
  { match: /dashboard|command|control room|overview|pipeline/i, text: 'Overview shows today’s work. Workforce shows people and journeys. Payments shows money and receipts. Document checks shows contracts and deadlines. Candidates opens individual records. Your account determines which agencies and records you can see.' },
  { match: /contract|expiring|document checks/i, text: 'Review contracts, agency agreements and expiry dates. Check the original document before confirming it. A reminder link opens a messaging service; you must send the reminder there.' },
  { match: /task|workload|workboard/i, text: 'My tasks shows work for your role. Open the record, check evidence and save your permitted action or follow-up there. Managers assign or balance current stages within their scope; staff follow due dates. Candidate reminders only suggest document submissions. Assigning work never marks a payment received or skips a stage.' },
  { match: /staff|user management|profile approvals/i, text: 'Review staff accounts and approve access where your role allows it. Local agencies manage their own staff. Superadmins manage access across the portal. Changing a role changes what that person can view or edit.' },
  { match: /candidate introductions|profile|candidate/i, text: 'Open a candidate to review ministry profile details, stage progress, documents, payments and next steps. Stage progression comes from the ministry; permitted evidence and follow-up work stay in DAWM.' },
  { match: /chat|message|inbox/i, text: 'Read and reply to candidate or agency messages. Unread counts show messages not yet marked read. Sending an issue for review does not automatically send a chat message.' },
  { match: /attendance|presence|online|roster/i, text: 'See recent sign-ins and account activity. An online dot shows recent activity, not proof of hours worked. Demo activity is recorded in this browser.' },
  { match: /map|centre|center|training|destination|journey/i, text: 'Explore current candidate stages, ministry-supplied locations and dated journey records. Candidates waiting for a location remain accounted for in the roster.' },
  { match: /notification/i, text: 'Read saved notices and mark them read. A saved notice does not prove that an email or text message was delivered.' },
  { match: /auth code|authorization/i, text: 'Create staff sign-up codes and check when they expire. Only authorized administrators can issue or cancel these codes. Never share your account password.' },
  { match: /settings|configuration/i, text: 'Manage the settings your role allows, including agency details and fees. Candidate payment amounts must agree with the payment service’s configured fees.' },
  { match: /public tracking/i, text: 'Enter a tracking code to see a candidate’s progress. Public tracking does not allow anyone to edit the record or confirm a payment.' },
  { match: /getting started|guide/i, text: 'Follow the guide for your role. Demo actions use practice records; real approvals and payments need the required proof.' },
  { match: /layout/i, text: 'Move, resize or hide dashboard panels in this browser. This only changes their appearance, not the saved records.' },
];

function featureHelp(title: string) {
  return HELP.find(item => item.match.test(title))?.text ?? 'Open the related record and check its details before making changes. You can only edit what your account allows. Demo records are for practice and are not official proof.';
}

function headingText(children: React.ReactNode): string {
  return React.Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return headingText(child.props.children);
    return '';
  }).filter(Boolean).join('').trim();
}

export const FeatureCardTitle = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof CardTitle>>(({ children, ...props }, ref) => {
  const title = headingText(children);
  return <CardTitle ref={ref} {...props} aria-label={props['aria-label'] ?? title}>{children}{title && <FeatureInfo title={title} className="ml-1 align-middle" />}</CardTitle>;
});
FeatureCardTitle.displayName = 'FeatureCardTitle';

export default function FeatureInfo({ title, description, className }: { title: string; description?: string; className?: string }) {
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" aria-label={`About ${title}`} title={`About ${title}`} className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
        <Info className="h-4 w-4" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] text-sm">
      <p className="mb-2 font-semibold">{title}</p>
      {description && <details className="mb-3 text-muted-foreground"><summary className="cursor-pointer">Context &amp; requirements</summary><p className="pt-2">{description}</p></details>}
      <p className="leading-relaxed">{featureHelp(title)}</p>
    </PopoverContent>
  </Popover>;
}