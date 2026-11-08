// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HeartPulse } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CandidateCheckpoint from '../CandidateCheckpoint';
import CandidateContacts from '../CandidateContacts';
import CandidateIntroductionMedia from '../CandidateIntroductionMedia';
import EmploymentJourneyHistory from '../EmploymentJourneyHistory';
import ContractVisaPanel from '../ContractVisaPanel';
import { generateDemoDataset } from '@/lib/demo-dataset';
import type { CandidateDetail } from '@/lib/types';

const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate: CandidateDetail = { ...demo.candidates[0], stages: [], documents: [], medical_results: [], chat_messages: [] };
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe('consistent candidate checkpoints', () => {
  it('keeps accessible feature help, a zero metric and working actions', async () => {
    const edit = vi.fn();
    await act(async () => root.render(<CandidateCheckpoint eyebrow="Candidate health checkpoint" title="Medical compliance" description="Review saved results." icon={HeartPulse} metric={0} metricLabel="Recorded checks" actions={<button onClick={edit}>Edit details</button>} />));
    expect(container.querySelector('[data-candidate-checkpoint="Medical compliance"]')).not.toBeNull();
    expect(container.querySelector('.control-nav-icon svg')).not.toBeNull();
    expect(container.querySelector('[aria-label="About Medical compliance"]')).not.toBeNull();
    expect(container.textContent).toContain('0Recorded checks');
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Edit details')!.click());
    expect(edit).toHaveBeenCalledOnce();
  });
  it('uses the same profile style without hiding contacts, introductions or history empty states', async () => {
    await act(async () => root.render(<><CandidateContacts candidate={candidate} onChanged={vi.fn()} /><CandidateIntroductionMedia candidate={{ ...candidate, intro_video_url: undefined }} /><EmploymentJourneyHistory candidate={{ ...candidate, employment_history: [] }} /></>));
    expect([...container.querySelectorAll('[data-candidate-checkpoint]')].map(header => header.getAttribute('data-candidate-checkpoint'))).toEqual(['Contact and emergency details', 'Candidate introduction', 'Employment journey']);
    expect(container.textContent).toContain(candidate.phone_number);
    expect(container.textContent).toContain('Introduction video: required');
    expect(container.textContent).toContain('No completed employment journeys recorded.');
  });
  it('keeps compact introductions compact', async () => {
    await act(async () => root.render(<CandidateIntroductionMedia candidate={candidate} compact />));
    expect(container.querySelector('[data-candidate-checkpoint]')).toBeNull();
    expect(container.textContent).toContain('Professional summary');
  });
  it('shows actual contract/visa availability, including explicit unavailable provider records', async () => {
    await act(async () => root.render(<ContractVisaPanel candidateDetail={{ ...candidate, external_status: { work_contract: true, visa: false } }} refetch={vi.fn()} />));
    expect(container.textContent).toContain('1 / 2');
    expect(container.textContent).toContain('Not received');
    expect(container.textContent).toContain('Having these documents does not replace official clearance');
    await act(async () => root.render(<ContractVisaPanel candidateDetail={{ ...candidate, external_status: { work_contract: false, visa: false } }} refetch={vi.fn()} />));
    expect(container.textContent).toContain('0 / 2');
  });
});
