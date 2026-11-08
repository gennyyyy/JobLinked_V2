import { normalize } from '../aiProvider.js';

// Spec v1.1 §4 step 2. A profile signal the seeker lacks is dropped and the
// remaining weights renormalize, so a sparse profile still produces a total
// order (recency alone when the profile is empty).
const WEIGHTS = { skills: 0.55, barangay: 0.2, position: 0.1, recency: 0.15 };

// Only the leading candidates need an explanation; the full pool is ordered.
const REASON_POOL = 30;
const MAX_REASON_CHARS = 200;

// Reasons are untrusted text (model output included): control characters are
// dropped before the whitespace normalize. Char-code filter instead of a
// control-char regex keeps eslint's no-control-regex rule honest.
const printable = (text) =>
  Array.from(String(text), (ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('');

// The one reason sanitizer: normalize, strip control characters, cap. Exported
// (and reused by the aiMatch route) so the contract is testable without a
// contrived job row.
export const capReason = (text) => normalize(printable(text)).slice(0, MAX_REASON_CHARS).trim();

const words = (text) => normalize(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const uniqueWords = (text) => [...new Set(words(text))];

const uniqueSkills = (skills) => [
  ...new Set((Array.isArray(skills) ? skills : []).map((s) => normalize(s).toLowerCase()).filter(Boolean)),
];

const tagSet = (tags) => new Set((Array.isArray(tags) ? tags : []).map((t) => normalize(t).toLowerCase()).filter(Boolean));

const timeOf = (value) => (value == null ? NaN : new Date(value).getTime());

// Score first, then newest created_at, then id: a total order with no clock.
const compareRanked = (a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  const aTime = Number.isFinite(a.time) ? a.time : -Infinity;
  const bTime = Number.isFinite(b.time) ? b.time : -Infinity;
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;
  const aId = String(a.job.id);
  const bId = String(b.job.id);
  return aId < bId ? -1 : aId > bId ? 1 : 0;
};

export function rankPool(jobs = [], profile = {}) {
  const rows = Array.isArray(jobs) ? jobs : [];
  const seeker = profile || {};

  const skills = uniqueSkills(seeker.skills);
  const barangay = normalize(seeker.barangay_district);
  const positionWords = uniqueWords(seeker.preferred_position);
  const hasProfileSignal = skills.length > 0 || barangay !== '' || positionWords.length > 0;

  // ponytail: recency is relative to the pool (no clock read, stays pure). A
  // time-decay score is only needed if absolute freshness starts to matter.
  const times = rows.map((job) => timeOf(job.created_at));
  const dates = times.filter((t) => Number.isFinite(t));
  const oldest = dates.length ? Math.min(...dates) : 0;
  const newest = dates.length ? Math.max(...dates) : 0;

  const ranked = rows.map((job, index) => {
    let points = 0;
    let active = 0;
    const clauses = [];

    if (skills.length) {
      active += WEIGHTS.skills;
      const tags = tagSet(job.tags);
      const matched = skills.filter((skill) => tags.has(skill)).length;
      points += WEIGHTS.skills * (matched / skills.length);
      if (matched) clauses.push(`Skills match ${matched} of ${skills.length}`);
    }

    if (barangay) {
      active += WEIGHTS.barangay;
      if (normalize(job.location) === barangay) {
        points += WEIGHTS.barangay;
        clauses.push('Same barangay');
      }
    }

    if (positionWords.length) {
      active += WEIGHTS.position;
      const titleWords = new Set(words(job.title));
      const matched = positionWords.filter((word) => titleWords.has(word)).length;
      points += WEIGHTS.position * (matched / positionWords.length);
      if (matched) clauses.push('Title matches your preferred position');
    }

    active += WEIGHTS.recency;
    const time = times[index];
    const recency = Number.isFinite(time) && newest > oldest ? (time - oldest) / (newest - oldest) : 0;
    points += WEIGHTS.recency * recency;

    const fallback = hasProfileSignal ? 'No profile signals matched' : 'Ranked by posting date';
    return {
      job,
      time,
      score: points / active,
      reason: clauses.length ? clauses.join(' · ') : fallback,
    };
  });

  ranked.sort(compareRanked);

  return {
    order: ranked.map((entry) => entry.job.id),
    reasons: ranked.slice(0, REASON_POOL).map((entry) => ({
      jobId: entry.job.id,
      reason: capReason(entry.reason),
    })),
  };
}
