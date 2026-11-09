// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EditableGrid from '../EditableGrid';

vi.mock('@/lib/layout-edit', () => ({ useLayoutEdit: () => ({ editing: false, setEditable: vi.fn() }) }));
vi.mock('@/lib/demo-mode', () => ({ DEMO_KEY_PREFIX: 'dawm_demo_', isDemoMode: () => false }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async () => act(async () => root.render(<EditableGrid pageId="sizing" items={[
  { id: 'score', title: 'Score', span: 6, node: <section>Short score card</section> },
  { id: 'resolution', title: 'Payment issues', span: 12, node: <section>Review board</section> },
]} />));
it('uses full-width review boards and natural card heights instead of stretching small cards to match long boards', async () => {
  await render();
  expect(container.querySelector('[data-tour="sizing-resolution"]')?.className).toContain('lg:col-span-12');
  expect(container.querySelector('.grid')?.className).toContain('items-start');
  expect(container.querySelector('[class*="[&>*]:h-full"]')).toBeNull();
});
it('preserves saved sizing, hidden tiles and order when dashboard defaults improve', async () => {
  const saved = { order: ['resolution', 'score'], hidden: ['score'], spans: { resolution: 6 } };
  localStorage.setItem('dawm_layout:sizing', JSON.stringify(saved));
  await render();
  expect(container.querySelector('[data-tour="sizing-resolution"]')?.className).toContain('lg:col-span-6');
  expect(container.querySelector('[data-tour="sizing-score"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem('dawm_layout:sizing')!)).toEqual(saved);
});
