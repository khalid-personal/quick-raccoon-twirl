// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import CandidateDetailEditor from '../CandidateDetailEditor';
import { generateDemoDataset } from '@/lib/demo-dataset';

it('shows source-owned candidate and CoC details as grey read-only fields without a manual save action', async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const data = generateDemoDataset(Date.parse('2026-11-08'));
  const candidate = { ...data.candidates[0], stages: [], documents: [], medical_results: [], chat_messages: [],
    coc_facility_name: 'Recorded ministry center', local_agency_name: 'Recorded local agency' };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onClose = vi.fn(), onSuccess = vi.fn();
  try {
    await act(async () => root.render(<CandidateDetailEditor candidate={candidate} onClose={onClose} onSuccess={onSuccess} />));
    expect(container.textContent).toContain('CoC assignments are read-only');
    expect(container.textContent).toContain('Fictional practice record');
    const fields = [...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')];
    expect(fields.length).toBeGreaterThan(20);
    fields.forEach(field => {
      expect(field.readOnly).toBe(true);
      expect(field.getAttribute('aria-disabled')).toBe('true');
      expect(field.className).toContain('ministry-owned-field');
    });
    expect(fields.some(field => field.value === 'Recorded ministry center')).toBe(true);
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).not.toContain('Save All Changes');
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
