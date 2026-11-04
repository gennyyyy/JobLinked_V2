import { api } from '../lib/api';

export function askHelp(messages) {
  return api.post('ai/help', { messages });
}

export function matchJobs(prompt, candidateIds) {
  return api.post('ai/job-match', { prompt, candidateIds });
}
