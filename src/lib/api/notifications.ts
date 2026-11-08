import { getNotifications, saveNotifications } from '../data-store';
import type { Notification } from '../types';
import { getEvidenceNotifications, markEvidenceNotificationsRead, type EvidenceNotificationScope } from '../evidence-notifications';

export const getNotificationsForUser = async (userId: string, scope?: EvidenceNotificationScope): Promise<Notification[]> =>
  [...getNotifications().filter(notification => notification.recipient_id === userId), ...getEvidenceNotifications(userId, scope)];

export const markNotificationRead = async (id: string): Promise<void> => {
  if (id.startsWith('evidence:')) { markEvidenceNotificationsRead([id]); return; }
  saveNotifications(getNotifications().map(notification => notification.id === id ? { ...notification, read: true } : notification));
};

export const markAllNotificationsReadForUser = async (userId: string, scope?: EvidenceNotificationScope): Promise<void> => {
  markEvidenceNotificationsRead(getEvidenceNotifications(userId, scope).map(notification => notification.id));
  saveNotifications(getNotifications().map(notification => notification.recipient_id === userId ? { ...notification, read: true } : notification));
};
