import { api } from '../lib/api';
import { NOTIFICATIONS_CHANGED } from '../utils/notificationEvents';

// user_id always comes from the session token, never params.
export async function listNotifications(userId, { unreadOnly = false } = {}) {
  void userId;
  return api.get('notifications/mine', { unreadOnly });
}

export async function markRead(id) {
  const result = await api.post(`notifications/${id}/read`);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  return result;
}

export async function markAllRead(userId) {
  void userId;
  const result = await api.post('notifications/read-all');
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  return result;
}

export async function deleteNotification(id) {
  const result = await api.del(`notifications/${id}`);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  return result;
}
