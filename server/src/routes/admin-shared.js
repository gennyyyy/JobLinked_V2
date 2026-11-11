import { likeEscape } from '../util.js';

// Constants shared by two or more admin router modules (ADR-026 split).
// Values only — no router lives here.

const USER_TABLES = { 'job-seeker': 'job_seekers', employer: 'employers', 'super-admin': 'super_admins' };
// B6: enum-valued filters are validated before they reach Postgres — an
// unknown value raises 22P02 (500) instead of the 400 the contract wants.
const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];

// B15: LIKE metacharacters in a search must match literally.
const likeFilter = (value) => `%${likeEscape(value)}%`;

export { USER_TABLES, ACCOUNT_STATUSES, likeFilter };
