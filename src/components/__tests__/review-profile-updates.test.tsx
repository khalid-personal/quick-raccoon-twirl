// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '../ui/tabs';
import ControlRoomTabs from '../ControlRoomTabs';
import MinistryQrPanel from '../MinistryQrPanel';
import PaymentEvidenceReview from '../PaymentEvidenceReview';
import MinistrySubmissionSettings from '../MinistrySubmissionSettings';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { getCandidates, getConfig, saveCandidates, savePayments, saveConfig, saveCandidateStages, savePaymentStatuses } from '@/lib/data-store';
import { loadReconciliationEvents, saveBankStatement } from '@/lib/bank-statement-store';
import { isCleared } from '@/lib/ksa-visa';
import type { Payment } from '@/lib/types';

const auth = vi.hoisted(() => ({ role: 'superadmin' }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'superadmin', email: 'finance@example.test' }, userRole: auth.role }) }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,c2ltdWxhdGlvbg==') } }));
const candidate = { ...generateDemoDataset(Date.parse('2026-11-07')).candidates[8], clearance: {
  enjaz: { status: 'completed' as const, updated_at: '2026-11-07' },
  tasheer: { status: 'completed' as const, updated_at: '2026-11-07' },
  local_ready_at: '2026-11-07',
  labour_ministry: { status: 'pending' as const, simulated: true },
}, visa: { visa_number: 'V1', status: 'validated' as const, checked_at: '2026-11-07', mode: 'sandbox' as const, expiry_date: '2027-12-31' } };
const payment: Payment = { id: 'demo-payment', amount: 100, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', stage_id: 1, payer_foreign_agency_id: '', payee_local_agency_id: 'local-a', provider_reference: 'REF', candidate_ids: [candidate.id], created_at: '2026-11-07', updated_at: '2026-11-07' };
const saveCompleteFee = () => {
  saveCandidates([{ ...candidate, local_agency_id: 'local-a' }]);
  saveConfig({ ...getConfig(), stageFees: { 1: 100 } });
  savePaymentStatuses([{ candidateId: candidate.id, stageId: 1, isPaid: true }]);
  saveCandidateStages([{ id: 'registration-stage', candidate_id: candidate.id, stage_id: 1, status: 'Completed', notes: '', date: '2026-11-07', updated_at: '2026-11-07' }]);
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear(); auth.role = 'superadmin';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes(label))!;
const renderReview = () => root.render(<MemoryRouter><PaymentEvidenceReview agencyId="local-a" evidence={{ caseId: payment.id, source: 'candidate', payment }} statementName="Stored statement" onClose={vi.fn()} /></MemoryRouter>);
describe('colored controls, ministry QR and paired evidence', () => {
  it('shows invalid ministry dates as an actionable error without crashing Settings', async () => {
    saveConfig({ ...getConfig(), ministrySubmissionWindow: { startsOn: 'invalid', endsOn: '2026-11-01' } });
    await act(async () => root.render(<MinistrySubmissionSettings />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('invalid');
    expect(container.querySelector<HTMLInputElement>('#submission-start')?.value).toBe('');
    expect(container.textContent).toContain('Enter a corrected window below');
  });
  it('renders a premium five-section navigation with restrained icons and accessible selection', async () => {
    await act(async () => root.render(<Tabs defaultValue="overview"><ControlRoomTabs /></Tabs>));
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['Overview', 'Workforce', 'Payments', 'Document checks', 'Candidates']);
    tabs.forEach(tab => {
      expect(tab.className).toContain('min-h-[104px]');
      expect(tab.className).toContain('dashboard-nav-item');
      expect(tab.querySelector('.dashboard-nav-glyph')).not.toBeNull();
      expect(tab.querySelector('.control-nav-signal')).toBeNull();
      expect(tab.className).toContain('motion-reduce:transition-none');
    });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(new Set(tabs.map(tab => (tab as HTMLElement).style.getPropertyValue('--nav-color'))).size).toBe(5);
    await act(async () => {
      tabs[2].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });
  it('shows pending QR explicitly, then a persisted demo QR without official clearance', async () => {
    sessionStorage.setItem('dawm_demo_session', '1'); saveCandidates([candidate]);
    const changed = vi.fn();
    await act(async () => root.render(<MinistryQrPanel candidate={candidate} onChanged={changed} />));
    expect(container.textContent).toContain('Pending ministry QR');
    expect(container.textContent).toContain('No QR issued yet');
    await act(async () => { button('Simulate demo ministry QR').click(); await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(changed).toHaveBeenCalled();
    await act(async () => root.render(<MinistryQrPanel candidate={getCandidates()[0]} onChanged={changed} />));
    expect(container.querySelector('img')?.getAttribute('alt')).toContain('DEMO');
    expect(container.textContent).toContain('DEMO / NOT OFFICIAL');
    expect(container.querySelector('a[download]')).not.toBeNull();
    expect(isCleared(getCandidates()[0])).toBe(false);
  });
  it('never presents an insecure or rejected QR as official clearance', async () => {
    await act(async () => root.render(<MinistryQrPanel candidate={{ ...candidate, clearance: { ...candidate.clearance, labour_ministry: { status: 'cleared', certificate_no: 'INVALID', qr_image_url: 'http://insecure.test/qr.png' } } }} />));
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).not.toContain('Official ministry QR issued');
    await act(async () => root.render(<MinistryQrPanel candidate={{ ...candidate, clearance: { ...candidate.clearance, labour_ministry: { status: 'rejected' } } }} />));
    expect(container.textContent).toContain('Ministry review failed');
    expect(button('Simulate demo ministry QR')).toBeUndefined();
  });
  it('automatically fills comparison from saved evidence and exposes both documents side by side', async () => {
    savePayments([payment]);
    saveCompleteFee();
    saveBankStatement('local-a', { name: 'Existing bank statement', lines: [{ amount: 100, currency: 'ETB', reference: 'REF', date: '2026-11-07', description: 'Incoming credit' }] }, 'candidate');
    await act(async () => renderReview());
    const paired = document.querySelector('[aria-label="Receipt and bank statement side by side"]')!;
    expect(paired.querySelectorAll('article')).toHaveLength(2);
    expect(paired.textContent).toContain('Download comparison PDF');
    expect(paired.textContent).not.toContain('Download statement CSV');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment marked received · details match');
    expect(document.querySelector('[aria-label="Payment comparison summary"]')?.textContent).toContain('Payment and bank-file details match');
    await act(async () => button('View comparison').click());
    expect(paired.querySelector('[hidden]')).toBeNull();
    expect(paired.querySelector('tbody')?.textContent).toContain('REF');
  });
  it('simulates missing demo evidence and refreshes the pending comparison to success', async () => {
    sessionStorage.setItem('dawm_demo_session', '1'); savePayments([payment]);
    saveCompleteFee();
    saveBankStatement('local-a', { name: 'DEMO / synthetic', synthetic: true, lines: [] }, 'candidate');
    await act(async () => renderReview());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment not yet confirmed · review needed');
    await act(async () => { button('Add a matching demo bank entry').click(); await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment marked received · details match');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Details match');
  });
  it('does not green-clear an incomplete candidate allocation just because a bank row matches', async () => {
    savePayments([payment]);
    saveBankStatement('local-a', { name: 'Existing bank statement', lines: [{ amount: 100, currency: 'ETB', reference: 'REF', date: '2026-11-07', description: 'Incoming credit' }] }, 'candidate');
    await act(async () => renderReview());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment not yet confirmed · review needed');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Full clearance also depends on');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Automatically cleared after all checks');
  });
  it('refreshes retained reviews from current receipts and never presents deleted snapshots as green', async () => {
    savePayments([payment]); saveCompleteFee();
    saveBankStatement('local-a', { name: 'Bank', lines: [{ amount: 100, currency: 'ETB', reference: 'REF', date: '2026-11-07', description: 'Credit' }] }, 'candidate');
    await act(async () => renderReview());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Automatically cleared after all checks');
    await act(async () => {
      savePayments([{ ...payment, amount: 150 }]);
      saveBankStatement('local-a', { name: 'Bank', lines: [{ amount: 150, currency: 'ETB', reference: 'REF', date: '2026-11-07', description: 'Credit' }] }, 'candidate');
    });
    expect(document.querySelector('[aria-label="Receipt and bank statement side by side"]')?.textContent).toContain('Receipt: 150.00');
    expect(document.querySelector('[aria-label="Evidence comparison checks"]')?.textContent).toContain('Currency: MatchReceipt: ETBBank: ETB');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Automatically cleared after all checks');
    await act(async () => { savePayments([]); window.dispatchEvent(new Event('supabase-data-changed')); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('no longer in the current payment records');
  });
  it('downloads one real comparison PDF and invalidates displayed matching if the bank statement is removed', async () => {
    const create = vi.fn((blob: Blob) => `blob:test-${blob.size}`), revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    savePayments([payment]);
    saveBankStatement('local-a', { name: 'Existing bank statement', lines: [{ amount: 100, currency: 'ETB', reference: 'REF', date: '2026-11-07', description: 'Incoming credit' }] }, 'candidate');
    await act(async () => renderReview());
    await act(async () => {
      button('Download comparison PDF').click();
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(create.mock.calls[0][0].type).toBe('application/pdf');
    expect(click).toHaveBeenCalledTimes(1);
    const { removeBankStatement } = await import('@/lib/bank-statement-store');
    await act(async () => removeBankStatement('local-a', 'candidate'));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment not yet confirmed · review needed');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Payment and bank-file details match');
  });
  it('records a superadmin override separately from a real match and hides controls from staff', async () => {
    savePayments([payment]);
    await act(async () => renderReview());
    await act(async () => button('Choose the next action').click());
    expect(button('Accept this exception').disabled).toBe(true);
    await act(async () => {
      const input = document.querySelector<HTMLTextAreaElement>('[data-field="case-note"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Finance approved this exception');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { button('Accept this exception').click(); await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(loadReconciliationEvents('local-a')[0].override?.actorId).toBe('superadmin');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Superadmin accepted exception');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Payment not yet confirmed · review needed');
    auth.role = 'staff';
    await act(async () => renderReview());
    expect(button('Accept this exception')).toBeUndefined();
  });
});
