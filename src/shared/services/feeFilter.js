import { api } from '../lib/api';

export const getFeeTerms = () => api.get('jobs/fee-filter/terms');