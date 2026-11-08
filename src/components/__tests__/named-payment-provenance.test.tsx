// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import PaymentProvenance from '../PaymentProvenance';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { saveCandidates, saveForeignAgencies, saveLocalAgencies, savePayments } from '@/lib/data-store';
import { demoActorIdentity } from '@/lib/demo-identities';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('../CandidateQuickViewProvider', () => ({
  CandidateWorkspaceLink: ({ children, candidateId }: { children: ReactNode; candidateId: string }) => <span data-candidate-id={candidateId}>{children}</span>,
  EntityProfileButton: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
const demo = generateDemoDataset(new Date('2026-11-07T12:00:00Z').getTime());
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveCandidates(demo.candidates); saveLocalAgencies(demo.localAgencies); saveForeignAgencies(demo.foreignAgencies); savePayments(demo.payments);
});
const render = (payment: (typeof demo.payments)[number]) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<PaymentProvenance payment={payment} />);
  return container;
};

describe('named payment audit presentation', () => {
  it('shows the candidate initiator, local agency recorder and reference without implying real proof', () => {
    const payment = demo.payments.find(item => item.payer_type === 'candidate')!;
    const candidate = demo.candidates.find(item => item.id === payment.payer_candidate_id)!;
    const manager = demoActorIdentity(payment.recorded_by!.id)!;
    const container = render(payment);
    expect(container.querySelector(`[data-candidate-id="${candidate.id}"]`)?.textContent).toBe(`${candidate.first_name} ${candidate.last_name} · ${candidate.email}`);
    expect(container.textContent).toContain(`${manager.name} · ${manager.email}`);
    expect(container.textContent).toContain('Not real bank proof or a live bank confirmation');
    expect(container.textContent).toContain(payment.provider_reference);
    expect(container.textContent).toContain(`${candidate.first_name} ${candidate.last_name} · ${candidate.tracking_code}`);
  });
  it('shows the fictional foreign-agency operator for agency settlements', () => {
    const payment = demo.payments.find(item => item.payer_type === 'foreign-agency')!;
    const initiator = demoActorIdentity(payment.initiated_by!.id)!;
    const container = render(payment);
    expect(container.textContent).toContain(`${initiator.name} · ${initiator.email}`);
    expect(container.textContent).toContain('Practice / synthetic payment and staff attribution');
  });
});
