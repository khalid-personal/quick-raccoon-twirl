// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Activity } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import ControlRoomHeader from '../ControlRoomHeader';
import ControlRoomTabs from '../ControlRoomTabs';
import WidgetShell from '../WidgetShell';
import CandidateStatusSummary from '../CandidateStatusSummary';
import PortalBackdrop from '../PortalBackdrop';
import StatCards from '../page/StatCards';

vi.mock('../FeatureInfo', () => ({ default: () => null }));
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const sections = ['overview', 'portfolio', 'finance', 'compliance', 'candidates'];
function DashboardViews() {
  const [value, setValue] = useState('overview');
  return <Tabs value={value} onValueChange={setValue}>
    <ControlRoomTabs />
    {sections.map(section => <TabsContent key={section} value={section}>{section} content</TabsContent>)}
  </Tabs>;
}

describe('shared dashboard design', () => {
  it('keeps the atmospheric background decorative and outside keyboard navigation', async () => {
    await act(async () => root.render(<PortalBackdrop />));
    const backdrop = container.querySelector('.portal-backdrop');
    expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    expect(backdrop?.querySelectorAll('.portal-backdrop-glow')).toHaveLength(2);
    expect(backdrop?.querySelectorAll('.portal-backdrop-orbit')).toHaveLength(2);
    expect(backdrop?.querySelector('.portal-backdrop-grid')).not.toBeNull();
    expect(backdrop?.querySelector('button, a, input, [tabindex]')).toBeNull();
  });

  it('preserves selectable branded summary cards', async () => {
    const onClick = vi.fn();
    await act(async () => root.render(<StatCards items={[{ label: 'Review records', value: '12', active: true, onClick }]} />));
    expect(container.querySelector('.portal-kpi')).not.toBeNull();
    expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => container.querySelector('button')?.click());
    expect(onClick).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('12');
  });
  it('keeps all five named views independently accessible', async () => {
    await act(async () => root.render(<DashboardViews />));
    const triggers = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(triggers.map(trigger => trigger.getAttribute('aria-label'))).toEqual(['Overview', 'Workforce', 'Payments', 'Document checks', 'Candidates']);
    for (const [index, trigger] of triggers.entries()) {
      await act(async () => trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
      expect(trigger.getAttribute('aria-selected')).toBe('true');
      expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toBe(`${sections[index]} content`);
    }
  });

  it('preserves header actions and widget contents with semantic warning accents', async () => {
    const onClick = vi.fn();
    await act(async () => root.render(<>
      <ControlRoomHeader scope="Local agency" description="Your assigned candidates and receipts." actions={<button onClick={onClick}>Open payments</button>} />
      <WidgetShell title="Receipt checks" description="Original amounts stay unchanged." icon={Activity} accent="rose">
        <p>ETB 1,200</p>
      </WidgetShell>
    </>));
    expect(container.querySelector('h1')?.textContent).toBe('Dashboard');
    expect(container.querySelector('.portal-dashboard-scope')?.textContent).toContain('Local agency');
    expect(container.querySelector('.portal-widget-icon')?.getAttribute('data-accent')).toBe('rose');
    expect(container.textContent).toContain('ETB 1,200');
    await act(async () => container.querySelector<HTMLButtonElement>('.portal-dashboard-actions button')?.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps candidate status filtering and clearing on branded totals', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(<CandidateStatusSummary candidates={[]} active={null} onSelect={onSelect} />));
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click());
    expect(onSelect).toHaveBeenLastCalledWith('inProgress');
    await act(async () => root.render(<CandidateStatusSummary candidates={[]} active="inProgress" onSelect={onSelect} />));
    expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click());
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
