// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { assignForeignStaffTask, getForeignStaffWork, rebalanceForeignStaffTasks } from '../foreign-staff-work';
import { foreignAgencyTasks } from '../../foreign-staff-tasks';
import { getCandidateStages, getConfig, saveCandidateStages, saveCandidates, saveConfig, saveStaffUsers } from '../../data-store';
import type { Candidate, CandidateStage, StaffUser } from '../../types';

const candidate = (id: string, agency: string) => ({
  id, first_name: 'Test', last_name: id, tracking_code: id, foreign_agency_id: agency, local_agency_id: 'local',
  created_at: '2026-01-01', updated_at: '2026-01-01', payment_status: 'unpaid',
} as Candidate);
const stages = (id: string): CandidateStage[] => [1, 3, 2, 4].map(stageId => ({
  id: `${id}-${stageId}`, candidate_id: id, stage_id: stageId, status: 'Pending',
  updated_at: '2026-01-01', assigned_staff_id: 'local-owner',
}));
const staff = (id: string, role: StaffUser['role'], agency: string, approved = true): StaffUser => ({
  id, role, foreign_agency_id: agency, is_approved: approved, email: `${id}@example.test`, created_at: '2026-01-01',
});
const manager = staff('manager', 'foreign-agency', 'a');
const member = staff('member', 'foreign-agency-staff', 'a');
const other = staff('other', 'foreign-agency-staff', 'b');
const perspective = (person: StaffUser) => sessionStorage.setItem('dawm_view_as', JSON.stringify({
  role: person.role, userId: person.id, foreignAgencyId: person.foreign_agency_id, label: person.email,
}));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveConfig({ ...getConfig(), stageFees: { 1: 0, 3: 0, 2: 0, 4: 0 } });
  saveCandidates([candidate('one', 'a'), candidate('two', 'a'), candidate('three', 'b')]);
  saveStaffUsers([manager, member, other, staff('pending', 'foreign-agency-staff', 'a', false)]);
  saveCandidateStages([...stages('one'), ...stages('two'), ...stages('three')]);
  perspective(manager);
});

describe('foreign agency workload', () => {
  it('balances only current tasks in its agency and persists without changing local owners', async () => {
    expect(await rebalanceForeignStaffTasks()).toEqual({ assigned: 2, changed: 2 });
    const saved = getCandidateStages();
    expect(saved.filter(stage => stage.foreign_assigned_staff_id === member.id)).toHaveLength(2);
    expect(saved.filter(stage => stage.candidate_id === 'three').every(stage => !stage.foreign_assigned_staff_id)).toBe(true);
    expect(saved.every(stage => stage.assigned_staff_id === 'local-owner')).toBe(true);
    perspective(member);
    const result = await getForeignStaffWork();
    expect(result.tasks.map(task => task.candidate.id)).toEqual(['one', 'two']);
    await expect(rebalanceForeignStaffTasks()).rejects.toThrow('administrator');
    await expect(assignForeignStaffTask('one', 1, member.id)).rejects.toThrow('administrator');
    perspective(other);
    expect((await getForeignStaffWork()).tasks).toHaveLength(0);
  });
  it('rejects other agencies, unapproved owners, non-current tasks and forged perspectives', async () => {
    await expect(assignForeignStaffTask('one', 1, other.id)).rejects.toThrow('approved staff');
    await expect(assignForeignStaffTask('one', 1, 'pending')).rejects.toThrow('approved staff');
    await expect(assignForeignStaffTask('three', 1, member.id)).rejects.toThrow('current task');
    await expect(assignForeignStaffTask('one', 3, member.id)).rejects.toThrow('current task');
    sessionStorage.setItem('dawm_view_as', JSON.stringify({ role: 'foreign-agency', userId: member.id, foreignAgencyId: 'a', label: 'manager' }));
    await expect(getForeignStaffWork()).rejects.toThrow('approved account');
  });
  it('uses canonical order and retains unpaid completion as an awaiting-payment task', () => {
    const c = candidate('one', 'a');
    const records = stages('one');
    records[0].status = 'Completed';
    const blocked = foreignAgencyTasks('a', [c], records, { 1: 100 }, [], []);
    expect(blocked[0]).toMatchObject({ stage: { stage_id: 1 }, action: 'Awaiting payment' });
    const next = foreignAgencyTasks('a', [c], records, { 1: 0 }, [], []);
    expect(next[0].stage.stage_id).toBe(3);
    records[1].status = 'Completed';
    expect(foreignAgencyTasks('a', [c], records, { 1: 0, 3: 0 }, [], [])[0].stage.stage_id).toBe(2);
  });
});
