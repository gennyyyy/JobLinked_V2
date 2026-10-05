import { api } from '../lib/api';

// user_id always comes from the session token, never params.
export async function listNotifications(userId, { unreadOnly = false } = {}) {
  void userId;
  return api.get('notifications/mine', { unreadOnly });
}

export async function markRead(id) {
  return api.post(`notifications/${id}/read`);
}

export async function markAllRead(userId) {
  void userId;
  return api.post('notifications/read-all');
}
