// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ContractUpload from '../ContractUpload';
import { scanContractFile } from '@/lib/contract-extraction';
import { getCandidates, getDocuments, saveCandidates } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'admin', email: 'admin@example.test' }, userRole: 'superadmin' }) }));
vi.mock('@/lib/contract-extraction', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/contract-extraction')>(), scanContractFile: vi.fn(),
}));
vi.mock('@/lib/document-files', () => ({ saveDocumentFile: vi.fn(), deleteDocumentFile: vi.fn() }));
vi.mock('../DocumentScanInput', () => ({ default: ({ onChange }: { onChange: (value: unknown) => void }) =>
  <button onClick={() => onChange({ file: new File(['%PDF-1.4'], 'synthetic-contract.pdf', { type: 'application/pdf' }), report: { status: 'clear', findings: [], scanned_at: '2026-11-08' }, ready: true })}>Choose original</button>,
}));
const candidate = generateDemoDataset(Date.parse('2026-11-08')).candidates[0];
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  saveCandidates([candidate]);
  vi.mocked(scanContractFile).mockResolvedValue({ fields: { employer: 'Fictional Household', employer_phone: '+966500000001' }, warnings: [], scannedPages: 1 });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === text)!;
it('autofills fields only after scanning, requires review, resets review after an edit and saves the exact reviewed values', async () => {
  const changed = vi.fn();
  await act(async () => root.render(<ContractUpload candidate={candidate} onChanged={changed} />));
  await act(async () => button('Choose original').click());
  const employer = [...container.querySelectorAll<HTMLInputElement>('input')].find(input => input.value === 'Fictional Household')!;
  expect(employer).toBeDefined();
  const save = button('Save received contract');
  expect(save.disabled).toBe(true);
  await act(async () => container.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
  expect(save.disabled).toBe(false);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(employer, 'Reviewed Household');
    employer.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(save.disabled).toBe(true);
  await act(async () => container.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
  await act(async () => { save.click(); await new Promise(resolve => setTimeout(resolve, 160)); });
  expect(getCandidates()[0].employer?.company).toBe('Reviewed Household');
  expect(getDocuments()[0].extracted?.employer).toBe('Reviewed Household');
  expect(changed).toHaveBeenCalledOnce();
  expect(container.textContent).not.toContain('Mark sent');
});
it('shows OCR failures explicitly and permits reviewed manual transcription without claiming a scan succeeded', async () => {
  vi.mocked(scanContractFile).mockRejectedValue(new Error('Unreadable PDF'));
  await act(async () => root.render(<ContractUpload candidate={candidate} onChanged={vi.fn()} />));
  await act(async () => button('Choose original').click());
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Automatic extraction failed: Unreadable PDF');
  expect([...container.querySelectorAll<HTMLInputElement>('input')].every(input => input.value === '')).toBe(true);
  expect(button('Save received contract').disabled).toBe(true);
});
