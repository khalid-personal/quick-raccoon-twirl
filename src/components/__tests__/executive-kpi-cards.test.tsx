// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { saveCandidates, saveCandidateStages, saveChatMessages } from '@/lib/data-store';
import ExecutiveDashboard from '../ExecutiveDashboard';

vi.mock('recharts', () => {
  const chart = () => null;
  return Object.fromEntries(['Area', 'AreaChart', 'Bar', 'BarChart', 'CartesianGrid', 'Cell', 'ComposedChart', 'Pie', 'PieChart', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis'].map(name => [name, chart]));
});
vi.mock('../DashboardExplorer', () => ({ default: () => null }));
vi.mock('../RecentOperations', () => ({ default: () => null }));

it('opens a real drill-down from every summary card and switches metrics without leaving the dashboard', async () => {
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  saveCandidates(generateDemoDataset(Date.now()).candidates.slice(0, 2)); saveCandidateStages([]); saveChatMessages([]);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><ExecutiveDashboard /></QueryClientProvider></MemoryRouter>));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    const cards = [...container.querySelectorAll<HTMLButtonElement>('.executive-interactive-kpi > button')];
    expect(cards).toHaveLength(5);
    for (const card of cards) {
      expect(card.getAttribute('aria-haspopup')).toBe('dialog');
      const label = card.getAttribute('aria-label')!.replace('Explore ', '');
      await act(async () => card.click());
      expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe(`${label} · record breakdown`);
      await act(async () => document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]')!.click());
    }
    await act(async () => cards[0].click());
    const switchButton = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Explore another metric"] button')].find(button => button.textContent === 'Average time waiting')!;
    await act(async () => switchButton.click());
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Average time waiting · record breakdown');
    expect(document.querySelector('[aria-label="Metric cohort filters"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount()); client.clear(); container.remove();
  }
});
