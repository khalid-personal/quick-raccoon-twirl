// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { foreignUnderpaymentCycle, setForeignUnderpaymentRenewal } from '../foreign-underpayment-policy';
import { getConfig, saveConfig } from '../data-store';
import { updateAppConfig } from '../api/config-management';

const admin = { id: 'ministry-admin', email: 'superadmin1@dawm.test', role: 'superadmin' };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
});
describe('ministry foreign underpayment renewal calendar', () => {
  it('renews at midnight Ethiopia time, not UTC midnight', () => {
    const config = { foreignUnderpaymentRenewal: { renewsOn: '2026-11-10', cycleStartsOn: '2026-10-01' } };
    expect(foreignUnderpaymentCycle(config, new Date('2026-11-09T20:59:59Z'))).toMatchObject({ renewed: false, startsOn: '2026-10-01' });
    expect(foreignUnderpaymentCycle(config, new Date('2026-11-09T21:00:00Z'))).toMatchObject({ renewed: true, startsOn: '2026-11-10' });
  });
  it('preserves the active cycle when the ministry schedules its next renewal', async () => {
    saveConfig({ ...getConfig(), foreignUnderpaymentRenewal: { renewsOn: '2026-11-10' } });
    await setForeignUnderpaymentRenewal('2026-12-10', admin, new Date('2026-11-11T00:00:00Z'));
    expect(getConfig().foreignUnderpaymentRenewal).toEqual({ renewsOn: '2026-12-10', cycleStartsOn: '2026-11-10' });
    await setForeignUnderpaymentRenewal('2026-12-15', admin, new Date('2026-11-12T00:00:00Z'));
    expect(getConfig().foreignUnderpaymentRenewal?.cycleStartsOn).toBe('2026-11-10');
  });
  it('rejects malformed dates and reversed cycles without silently granting chances', () => {
    for (const renewsOn of ['2026-02-30', 'invalid', '2026-1-1']) expect(() => foreignUnderpaymentCycle({ foreignUnderpaymentRenewal: { renewsOn } })).toThrow('invalid');
    expect(() => foreignUnderpaymentCycle({ foreignUnderpaymentRenewal: { renewsOn: '2026-11-10', cycleStartsOn: '2026-12-01' } })).toThrow('invalid');
  });
  it('rejects unauthorized, past and impossible renewal dates without saving', async () => {
    const before = getConfig();
    await expect(setForeignUnderpaymentRenewal('2026-12-10', { ...admin, role: 'foreign-agency' })).rejects.toThrow('Only');
    for (const date of ['2026-02-30', '2026-11-09']) await expect(setForeignUnderpaymentRenewal(date, admin, new Date('2026-11-10T00:00:00Z'))).rejects.toThrow('valid renewal date');
    expect(getConfig()).toEqual(before);
  });
  it('prevents ordinary configuration saves from replacing the ministry calendar', async () => {
    saveConfig({ ...getConfig(), foreignUnderpaymentRenewal: { renewsOn: '2026-12-10', cycleStartsOn: '2026-11-10' } });
    const policy = getConfig().foreignUnderpaymentRenewal;
    await updateAppConfig({ ...getConfig(), foreignUnderpaymentRenewal: { renewsOn: '2027-01-01' } }, admin.id, admin.email);
    expect(getConfig().foreignUnderpaymentRenewal).toEqual(policy);
  });
});
