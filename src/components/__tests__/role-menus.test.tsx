// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShellNavGroup } from '../AppShell';
import type { UserRole } from '@/lib/types';
import AdminLayout from '../AdminLayout';
import AgencyLayout from '../AgencyLayout';
import LocalAgencyLayout from '../LocalAgencyLayout';
import AuditorLayout from '../AuditorLayout';
import { homeFor } from '../ViewAsButton';

const auth = vi.hoisted(() => ({ userRole: 'superadmin' as UserRole, userLocalAgencyName: 'Local agency' }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('../AppShell', () => ({ default: ({ portalName, navGroups }: { portalName: string; navGroups: ShellNavGroup[] }) =>
  <nav aria-label={portalName}>{navGroups.map(group => <section key={group.label}><h2>{group.label}</h2>{group.items.filter(item => !item.hidden).map(item =>
    <a key={item.label} href={item.to}>{item.label}</a>)}</section>)}</nav> }));

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const links = () => [...container.querySelectorAll('a')].map(link => link.getAttribute('href'));

describe('role-specific menu organization', () => {
  it('opens the appropriate workspace when previewing every access level', () => {
    expect((['superadmin', 'admin', 'staff', 'local-agency', 'agency', 'foreign-agency', 'foreign-agency-staff', 'auditor', 'viewer', 'candidate'] as const)
      .map(role => homeFor(role, 'TRK-1'))).toEqual(['/admin', '/admin', '/admin', '/local-agency', '/agency', '/agency', '/agency', '/auditor', '/viewer', '/track/TRK-1']);
  });
  it.each(['superadmin', 'admin', 'staff'] as const)('separates daily work and privileged management for %s', async role => {
    auth.userRole = role;
    await act(async () => root.render(<MemoryRouter><AdminLayout>Page</AdminLayout></MemoryRouter>));
    expect(links().slice(0, 2)).toEqual(['/admin', '/admin/tasks']);
    expect(container.querySelectorAll('section h2')).toHaveLength(4);
    expect(container.textContent).toContain(role === 'superadmin' ? 'Oversight & my tasks' : role === 'staff' ? 'My tasks' : 'My tasks & team');
    expect(links().includes('/admin/users')).toBe(role === 'superadmin');
    expect(links().includes('/admin/settings')).toBe(role === 'superadmin');
    expect(links()).not.toContain('/admin/auth-codes');
    expect(links()).not.toContain('/admin/notifications');
    expect(container.querySelector('a[href="/admin/integrity"]')?.closest('section')?.textContent).toContain('Candidate records');
  });
  it.each(['agency', 'foreign-agency', 'foreign-agency-staff'] as const)('keeps foreign receipts and management organized for %s', async role => {
    auth.userRole = role;
    await act(async () => root.render(<AgencyLayout>Page</AgencyLayout>));
    expect(links().slice(0, 2)).toEqual(['/agency', '/agency/tasks']);
    expect(container.querySelector('a[href="/agency/payments"]')?.textContent).toBe('Money sent');
    expect(links().includes('/agency/users')).toBe(role !== 'foreign-agency-staff');
    expect(links().some(link => link?.startsWith('/admin'))).toBe(false);
    expect(links()).not.toContain('/agency/candidate-chat');
  });
  it('keeps local management inside the local workspace', async () => {
    await act(async () => root.render(<LocalAgencyLayout>Page</LocalAgencyLayout>));
    expect(links().filter(link => link !== '/guide').every(link => link?.startsWith('/local-agency'))).toBe(true);
    expect(container.querySelector('a[href="/local-agency/payments"]')?.textContent).toBe('Payments received');
    expect(container.querySelector('a[href="/local-agency/users"]')?.closest('section')?.textContent).toContain('Team management');
  });
  it('does not show payment, assignment or account tools in the auditor menu', async () => {
    await act(async () => root.render(<AuditorLayout>Page</AuditorLayout>));
    expect(links()).toEqual(['/auditor', '/auditor/tasks', '/guide']);
    expect(container.textContent).toContain('Read-only review');
  });
});
