import { api } from '../lib/api';

export async function logAudit(action, entity = null, entityId = null, details = null) {
  try {
    await api.post('audit', { action, entity, entity_id: entityId, details });
  } catch (err) {
    console.warn('audit log failed:', err?.message || err);
  }
}
