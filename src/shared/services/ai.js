import { api } from '../lib/api';

export function askHelp(messages) {
  return api.post('ai/help', { messages });
}
