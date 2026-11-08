import {
  getApprovalLogs, getAttendanceRecords, getCandidates, getLocalAgencies, getNotifications, getPayments, getStaffUsers,
  saveApprovalLogs, saveAttendanceRecords, saveCandidates, saveNotifications, savePayments, saveStaffUsers,
} from './data-store';
import { DEMO_KEY_PREFIX, isDemoMode, VIEW_AS_KEY } from './demo-mode';
import { demoActorIdentity, demoAgencyManager, isSafeDemoEmail, paymentCandidateSummary, resolveActorIdentity } from './demo-identities';
import type { ViewAsTarget } from './auth-context';
import type { Payment } from './types';
import type { ReconciliationCaseEvent } from './bank-statement-store';

const MIGRATION_KEY = `${DEMO_KEY_PREFIX}named_identities_v1`;

export const migrateDemoIdentities = (): void => {
  if (!isDemoMode()) return;
  if (localStorage.getItem(MIGRATION_KEY)) return;
  const candidates = getCandidates();
  const normalizeActor = (actor: Payment['initiated_by']) =>
    actor?.email ? { ...actor, email: resolveActorIdentity(actor.id, actor.email, candidates).email } : actor;
  const update = <T,>(before: T[], after: T[], save: (items: T[]) => void) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) save(after);
  };
  const staff = getStaffUsers();
  update(staff, staff.map(user => {
    const identity = demoActorIdentity(user.id);
    return identity && isSafeDemoEmail(user.email) ? { ...user, email: identity.email! } : user;
  }), saveStaffUsers);
  update(candidates, candidates.map(candidate => {
    if (!candidate.id.startsWith('demo-')) return candidate;
    const local = demoAgencyManager(candidate.local_agency_id);
    const foreign = demoAgencyManager(candidate.foreign_agency_id);
    return { ...candidate,
      ...(candidate.clearance?.local_ready_by === 'Demo local agency' && local ? {
        clearance: { ...candidate.clearance, local_ready_by: local.email },
      } : {}),
      ...(candidate.work_contract_record ? { work_contract_record: {
        ...candidate.work_contract_record,
        sent_by: candidate.work_contract_record.sent_by === 'Demo foreign agency' && foreign ? foreign.email : candidate.work_contract_record.sent_by,
        received_by: candidate.work_contract_record.received_by === 'Demo local agency' && local ? local.email : candidate.work_contract_record.received_by,
      } } : {}),
    };
  }), saveCandidates);
  const payments = getPayments();
  update(payments, payments.map(payment => {
    const seeded = /^demo-(pay-|fpay-)/.test(payment.id);
    const initiator = payment.initiated_by ?? (seeded ? payment.payer_candidate_id
      ? resolveActorIdentity(payment.payer_candidate_id, undefined, candidates) : demoAgencyManager(payment.payer_foreign_agency_id) : undefined);
    const recorder = payment.recorded_by ?? (seeded ? demoAgencyManager(payment.payee_local_agency_id) : undefined);
    return { ...payment, ...(initiator ? { initiated_by: normalizeActor(initiator) } : {}),
      ...(recorder ? { recorded_by: normalizeActor(recorder) } : {}) };
  }), savePayments);
  const logs = getApprovalLogs();
  update(logs, logs.map(log => ({ ...log, actor_email: resolveActorIdentity(log.actor_id, log.actor_email, candidates).email ?? log.actor_email })), saveApprovalLogs);
  const attendance = getAttendanceRecords();
  update(attendance, attendance.map(record => ({
    ...record, staff_email: resolveActorIdentity(record.staff_id, record.staff_email, candidates).email ?? record.staff_email,
  })), saveAttendanceRecords);

  getLocalAgencies().filter(agency => agency.id.startsWith('demo-')).forEach(agency => {
    const key = `${DEMO_KEY_PREFIX}dawm_bank_statement:${agency.id}:cases`;
    const events = JSON.parse(localStorage.getItem(key) || '[]') as ReconciliationCaseEvent[];
    const normalized = events.map(event => {
      const oldOwner = staff.find(user => user.local_agency_id === agency.id && user.email === event.owner);
      const legacyManager = event.owner === `manager.l${agency.id.slice(-1)}@demo-agency.example.test`;
      const owner = oldOwner ? resolveActorIdentity(oldOwner.id, oldOwner.email).email ?? event.owner
        : legacyManager ? demoAgencyManager(agency.id)?.email ?? event.owner : event.owner;
      return { ...event, owner, evidence: { ...event.evidence, ...(event.evidence.payment ? {
        payment: { ...event.evidence.payment, initiated_by: normalizeActor(event.evidence.payment.initiated_by), recorded_by: normalizeActor(event.evidence.payment.recorded_by) },
      } : {}) } };
    });
    if (JSON.stringify(events) !== JSON.stringify(normalized)) localStorage.setItem(key, JSON.stringify(normalized));
  });

  const notifications = getNotifications();
  update(notifications, notifications.map(notification => {
    if (!/^(DEMO\s*\/\s*synthetic|demo\s*[&/]\s*synthetic)\s*[·:–-]?\s*/i.test(notification.message)) return notification;
    const payment = payments.find(item => notification.link.includes(encodeURIComponent(item.id)) || notification.link.includes(item.id));
    const candidate = candidates.find(item => notification.link.includes(item.id) || notification.link.includes(item.tracking_code));
    const identity = notification.recipient_id && demoActorIdentity(notification.recipient_id);
    const subject = payment ? `${paymentCandidateSummary(payment, candidates)} · ${payment.provider_reference || payment.receipt_number || payment.id}`
      : candidate ? `${candidate.first_name} ${candidate.last_name} (${candidate.tracking_code})` : identity?.name;
    if (!subject) return notification;
    return { ...notification, message: `${subject} · ${notification.message.replace(/^(DEMO\s*\/\s*synthetic|demo\s*[&/]\s*synthetic)\s*[·:–-]?\s*/i, '')} Practice / synthetic record, not real bank proof.` };
  }), saveNotifications);
  try {
    const target = JSON.parse(sessionStorage.getItem(VIEW_AS_KEY) || 'null') as ViewAsTarget | null;
    if (target?.userId) {
      const identity = resolveActorIdentity(target.userId, undefined, candidates);
      if (identity.name && isSafeDemoEmail(target.label)) sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify({ ...target, label: identity.email }));
    }
  } catch { /* A stale preview must not block opening the practice workspace. */ }
  localStorage.setItem(MIGRATION_KEY, '1');
};
