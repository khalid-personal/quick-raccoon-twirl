import { getCandidateStages, getCandidates, getConfig, getPayments, getPaymentStatuses, getStaffUsers, saveCandidateStages } from '../data-store';
import { LS_CANDIDATE_STAGES } from '../data-keys';
import { isDemoMode } from '../demo-mode';
import { balanceForeignTasks, foreignAgencyStaff, foreignAgencyTasks } from '../foreign-staff-tasks';
import { isSupabaseDataMode } from '../supabase-sync';
import { supabase } from '../supabase';
import type { CandidateStage } from '../types';
import { getApiPrincipal } from './auth';

async function workload() {
  const principal = await getApiPrincipal();
  if (!principal.foreignAgencyId || !['agency', 'foreign-agency', 'foreign-agency-staff'].includes(principal.role)) {
    throw new Error('An approved foreign agency account is required.');
  }
  const staff = foreignAgencyStaff(principal.foreignAgencyId, getStaffUsers());
  const stages = getCandidateStages();
  const tasks = foreignAgencyTasks(principal.foreignAgencyId, getCandidates(), stages, getConfig().stageFees ?? {}, getPaymentStatuses(), getPayments());
  const canManage = principal.role === 'agency' || principal.role === 'foreign-agency';
  return { principal, staff, stages, tasks, canManage };
}

export async function getForeignStaffWork() {
  const { principal, staff, tasks, canManage } = await workload();
  return { staff: canManage ? staff : staff.filter(user => user.id === principal.id), canManage,
    tasks: canManage ? tasks : tasks.filter(task => task.stage.foreign_assigned_staff_id === principal.id) };
}

async function persistAssignments(before: CandidateStage[], after: CandidateStage[]) {
  const prior = new Map(before.map(stage => [stage.id, stage]));
  const changed = after.filter(stage => prior.get(stage.id)?.foreign_assigned_staff_id !== stage.foreign_assigned_staff_id);
  if (!changed.length) return 0;
  if (isSupabaseDataMode() && !isDemoMode()) {
    // Update only the selected records, retaining newer local-stage fields from the server.
    const saved = [...before];
    for (const stage of changed) {
      const { data, error } = await supabase.from('candidate_stages').select('data').eq('id', stage.id).single();
      if (error || !data?.data) throw new Error('Could not load the current stage assignment.');
      const updated = { ...(data.data as CandidateStage), foreign_assigned_staff_id: stage.foreign_assigned_staff_id };
      const result = await supabase.from('candidate_stages').update({ data: updated }).eq('id', stage.id).select('id').single();
      if (result.error || !result.data) throw new Error('Could not save the stage assignment.');
      const index = saved.findIndex(item => item.id === stage.id);
      saved[index] = updated;
      localStorage.setItem(LS_CANDIDATE_STAGES, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    }
  } else saveCandidateStages(after);
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  return changed.length;
}

export async function assignForeignStaffTask(candidateId: string, stageId: number, staffId: string) {
  const { staff, stages, tasks, canManage } = await workload();
  if (!canManage) throw new Error('Only an agency administrator can assign work.');
  if (!staff.some(person => person.id === staffId)) throw new Error('Choose an approved staff member from your agency.');
  const task = tasks.find(item => item.candidate.id === candidateId && item.stage.stage_id === stageId);
  if (!task) throw new Error('Choose a current task belonging to your agency.');
  const next = stages.map(stage => stage.id === task.stage.id ? { ...stage, foreign_assigned_staff_id: staffId } : stage);
  await persistAssignments(stages, next);
}

export async function rebalanceForeignStaffTasks() {
  const { staff, stages, tasks, canManage } = await workload();
  if (!canManage) throw new Error('Only an agency administrator can balance work.');
  if (!staff.length) throw new Error('There are no approved staff members in your agency.');
  const changed = await persistAssignments(stages, balanceForeignTasks(tasks, stages, staff));
  return { assigned: tasks.length, changed };
}
