// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getApprovalLogs, getConfig, saveConfig } from '../../data-store';
import { updateAppConfig } from '../config-management';

const local = { id: 'local-1', name: 'Local agency', created_at: '2026-01-01' };
const foreign = { id: 'foreign-1', name: 'Foreign agency', country_code: 'SA', created_at: '2026-01-01' };
const actor = ['admin', 'admin@example.test'] as const;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('dawm_demo_session', '1');
  saveConfig({ ...getConfig(), cocFacilities: [{ id: 'center', name: 'Ministry assessment center', created_at: '2026-01-01' }], localAgencies: [local], foreignAgencies: [foreign], agencyPartnerships: [] });
});

describe('agency directory settings guard', () => {
  it('rejects candidate-linked CoC and country edits without saving settings or audit entries', async () => {
    const before = getConfig();
    const logs = getApprovalLogs();
    for (const cocFacilities of [[], [...before.cocFacilities, { id: 'manual-center', name: 'Manual center', created_at: '2026-11-08' }],
      before.cocFacilities.map((center, index) => index ? center : { ...center, city: 'Changed city' })]) {
      await expect(updateAppConfig({ ...before, cocFacilities, stageFees: { 1: 888 } }, ...actor)).rejects.toThrow('CoC directory');
    }
    await expect(updateAppConfig({ ...before, countryOptions: ['Changed'] }, ...actor)).rejects.toThrow('read-only');
    expect(getConfig()).toEqual(before);
    expect(getApprovalLogs()).toEqual(logs);
  });
  it.each([
    ['add local', { localAgencies: [local, { ...local, id: 'local-2' }] }],
    ['remove local', { localAgencies: [] }],
    ['rename local', { localAgencies: [{ ...local, name: 'Changed' }] }],
    ['change local ID', { localAgencies: [{ ...local, id: 'other' }] }],
    ['add foreign', { foreignAgencies: [foreign, { ...foreign, id: 'foreign-2' }] }],
    ['remove foreign', { foreignAgencies: [] }],
    ['rename foreign', { foreignAgencies: [{ ...foreign, name: 'Changed' }] }],
    ['change foreign country', { foreignAgencies: [{ ...foreign, country_code: 'AE' }] }],
  ])('rejects %s without saving any changes or audit entry', async (_label, change) => {
    const before = getConfig();
    const logs = getApprovalLogs();
    await expect(updateAppConfig({ ...before, ...change, stageFees: { 1: 777 } }, ...actor)).rejects.toThrow('ELMIS integration');
    expect(getConfig()).toEqual(before);
    expect(getApprovalLogs()).toEqual(logs);
  });

  it('rejects manual partnership assignment but saves unrelated settings', async () => {
    const before = getConfig();
    const partnership = { local_agency_id: local.id, foreign_agency_id: foreign.id, status: 'active' as const, started_at: '2026-11-08' };
    await expect(updateAppConfig({ ...before, agencyPartnerships: [partnership] }, ...actor)).rejects.toThrow('ministry-assigned');
    expect(getApprovalLogs()).toEqual([]);
    await updateAppConfig({ ...before, stageFees: { 1: 777 } }, ...actor);
    expect(getConfig()).toMatchObject({ localAgencies: [local], foreignAgencies: [foreign], stageFees: { 1: 777 }, agencyPartnerships: [] });
    expect(getApprovalLogs()).toHaveLength(1);
  });
  it.each([true, false])('rejects unlinking or changing source contracts in practice=%s', async practice => {
    if (!practice) sessionStorage.clear();
    const partnership = { local_agency_id: local.id, foreign_agency_id: foreign.id, status: 'active' as const, started_at: '2026-11-08' };
    saveConfig({ ...getConfig(), localAgencies: [local], foreignAgencies: [foreign], agencyPartnerships: [partnership] });
    const before = getConfig();
    await expect(updateAppConfig({ ...before, agencyPartnerships: [] }, ...actor)).rejects.toThrow('ministry-assigned');
    await expect(updateAppConfig({ ...before, agencyPartnerships: [{ ...partnership, status: 'suspended' }] }, ...actor)).rejects.toThrow('ministry-assigned');
    expect(getConfig()).toEqual(before);
  });

  it('rejects a stale directory snapshot instead of overwriting newer records', async () => {
    const stale = getConfig();
    const newer = { ...local, name: 'Updated elsewhere' };
    saveConfig({ ...stale, localAgencies: [newer] });
    await expect(updateAppConfig(stale, ...actor)).rejects.toThrow('ELMIS integration');
    expect(getConfig().localAgencies).toEqual([newer]);
  });
});
