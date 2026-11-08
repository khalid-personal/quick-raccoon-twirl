// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Files, LayoutDashboard, Users, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { SidebarContent } from '../AppShell';
import ControlRoomTabs from '../ControlRoomTabs';
import { PageMemoryProvider } from '@/hooks/use-page-memory';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'nav-review' }, userRole: 'superadmin', isDemo: true }) }));
vi.mock('../FeatureInfo', () => ({ default: () => null, FeatureCardTitle: () => null }));
vi.mock('../DawmBrand', () => ({ default: () => <span>DAWM</span> }));

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  localStorage.clear(); sessionStorage.clear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const key = async (element: HTMLElement, value: string) => {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

describe('shared navigation rail', () => {
  it('keeps Radix selection, disabled items, keyboard navigation and panel associations', async () => {
    const change = vi.fn();
    await act(async () => root.render(<Tabs defaultValue="overview" onValueChange={change}>
      <TabsList aria-label="Compact sections"><TabsTrigger value="overview"><LayoutDashboard />Overview</TabsTrigger><TabsTrigger value="blocked" disabled>Unavailable</TabsTrigger><TabsTrigger value="documents"><Files />Documents</TabsTrigger></TabsList>
      <TabsContent value="overview">Overview panel</TabsContent><TabsContent value="documents">Documents panel</TabsContent>
    </Tabs>));
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(container.querySelector('[role="tablist"]')?.className).toContain('navigation-rail');
    tabs.forEach(tab => expect(tab.className).toContain('navigation-rail-item'));
    await act(async () => tabs[0].focus());
    await key(tabs[0], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(change).toHaveBeenLastCalledWith('documents');
    const panel = document.getElementById(tabs[2].getAttribute('aria-controls')!);
    expect(panel?.getAttribute('aria-labelledby')).toBe(tabs[2].id);
    expect(panel?.textContent).toBe('Documents panel');
    await key(tabs[2], 'Home');
    expect(document.activeElement).toBe(tabs[0]);
    await key(tabs[0], 'End');
    expect(document.activeElement).toBe(tabs[2]);
  });

  it('keeps remembered uncontrolled sections when a workspace panel remounts', async () => {
    function Workspace() {
      const [visible, setVisible] = useState(true);
      return <><button onClick={() => setVisible(value => !value)}>Show workspace</button>{visible && <Tabs defaultValue="overview"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger></TabsList></Tabs>}</>;
    }
    await act(async () => root.render(<MemoryRouter><PageMemoryProvider><Workspace /></PageMemoryProvider></MemoryRouter>));
    await act(async () => container.querySelector<HTMLButtonElement>('[role="tab"][data-state="inactive"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    const toggle = container.querySelector<HTMLButtonElement>('button')!;
    await act(async () => toggle.click());
    await act(async () => toggle.click());
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Documents');
  });

  it('uses one static icon per dashboard item and retains the exact dashboard values', async () => {
    const change = vi.fn();
    await act(async () => root.render(<Tabs defaultValue="overview" onValueChange={change}><ControlRoomTabs /></Tabs>));
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['Overview', 'Workforce', 'Payments', 'Document checks', 'Candidates']);
    tabs.forEach(tab => {
      expect(tab.querySelectorAll('svg')).toHaveLength(1);
      expect(tab.querySelector('.control-nav-icon, .control-nav-signal, .dashboard-nav-indicator')).toBeNull();
    });
    const values = ['overview', 'portfolio', 'finance', 'compliance', 'candidates'];
    for (let index = 1; index < tabs.length; index++) {
      await act(async () => tabs[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
      expect(change).toHaveBeenLastCalledWith(values[index]);
    }
  });

  it('styles opted-in source toggles without changing values or deselection handling', async () => {
    const change = vi.fn();
    function Sources() {
      const [source, setSource] = useState('foreign');
      return <ToggleGroup navigation type="single" value={source} aria-label="Source" onValueChange={next => { change(next); if (next) setSource(next); }}>
        <ToggleGroupItem value="foreign"><Wallet />Foreign agency</ToggleGroupItem><ToggleGroupItem value="candidate"><Users />Candidate</ToggleGroupItem>
      </ToggleGroup>;
    }
    await act(async () => root.render(<Sources />));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons[0].className).toContain('navigation-rail-item');
    await act(async () => buttons[1].click());
    expect(change).toHaveBeenLastCalledWith('candidate');
    expect(buttons[1].getAttribute('data-state')).toBe('on');
    await act(async () => buttons[1].click());
    expect(change).toHaveBeenLastCalledWith('');
    expect(buttons[1].getAttribute('data-state')).toBe('on');
  });

  it('keeps sidebar routes, hidden permissions, action launchers and collapsed navigation', async () => {
    const action = vi.fn(), close = vi.fn();
    function ShellMenu({ collapsed }: { collapsed: boolean }) {
      const location = useLocation();
      return <><SidebarContent portalName="Agency" homePath="/agency" pathname={location.pathname} collapsed={collapsed} onNavigate={close} navGroups={[{ label: 'Work', items: [
        { to: '/agency', label: 'Dashboard', icon: <LayoutDashboard /> },
        { to: '/agency/payments', label: 'Payments', icon: <Wallet />, badge: 7 },
        { to: '/agency/restricted', label: 'Restricted', icon: <Users />, hidden: true },
        { to: '#', label: 'Public tracking', icon: <Files />, onClick: action },
      ] }]} /><output>{location.pathname}</output></>;
    }
    const render = (collapsed: boolean) => root.render(<MemoryRouter initialEntries={['/agency/payments/receipt']}><ShellMenu collapsed={collapsed} /></MemoryRouter>);
    await act(async () => render(false));
    const payments = container.querySelector<HTMLAnchorElement>('a[aria-label="Payments"]')!;
    expect(payments.getAttribute('aria-current')).toBe('page');
    expect(payments.querySelectorAll('svg')).toHaveLength(1);
    expect(payments.querySelector('.navigation-rail-count')?.textContent).toBe('7');
    expect(container.querySelector('a[aria-label="Dashboard"]')?.getAttribute('aria-current')).toBeNull();
    expect(container.textContent).not.toContain('Restricted');
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Public tracking"]')!.click());
    expect(action).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    await act(async () => render(true));
    expect(container.querySelector('.navigation-rail-sidebar-collapsed')).not.toBeNull();
    await act(async () => container.querySelector<HTMLAnchorElement>('a[aria-label="Dashboard"]')!.click());
    expect(container.querySelector('output')?.textContent).toBe('/agency');
  });
});
