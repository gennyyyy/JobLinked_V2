import { pool } from './db.js';

// Controlled job vocabularies (db/migrations/016: reference_data categories
// 'job_field' and 'skill'). One cached read per minute for the whole process;
// validation compares case-insensitively, stores the canonical casing for
// listed values, and keeps unlisted skills as typed.
const TTL_MS = 60_000;
export const MAX_SKILLS = 20;

const CATEGORIES = { field: 'job_field', skill: 'skill' };

// lowercased value -> canonical row value
const toMap = (rows) => new Map(rows.map((row) => [String(row.value).trim().toLowerCase(), row.value]));

let cache = null; // { at, vocab }

export async function loadVocabulary() {
  if (!cache || Date.now() - cache.at >= TTL_MS) {
    const [fields, skills] = await Promise.all([
      pool.query('select value from reference_data where category = $1', [CATEGORIES.field]),
      pool.query('select value from reference_data where category = $1', [CATEGORIES.skill]),
    ]);
    cache = { at: Date.now(), vocab: { field: toMap(fields.rows), skill: toMap(skills.rows) } };
  }
  return cache.vocab;
}

// Tests own the module cache's lifetime; production never calls this.
export function resetVocabularyCache() {
  cache = null;
}

// null/'' -> null (legacy rows stay valid); otherwise the canonical vocabulary
// value, or the raw value when it is not listed.
export async function canonicalizeField(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return { ok: true, value: null };
  const vocab = await loadVocabulary();
  const canonical = vocab.field.get(key);
  return canonical === undefined ? { ok: false, invalid: value } : { ok: true, value: canonical };
}

// Case-insensitive, deduped, capped. Blank entries are ignored (same as
// normalizeTags for tags); listed skills are stored in the vocabulary's
// canonical casing, unlisted ones are kept as typed.
export async function canonicalizeSkills(list) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length) return { ok: true, value: [] };
  const vocab = await loadVocabulary();
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const typed = String(raw ?? '').trim();
    const key = typed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(vocab.skill.get(key) ?? typed);
  }
  if (out.length > MAX_SKILLS) return { ok: false, tooMany: true };
  return { ok: true, value: out };
}

// Shared by the employer create/PATCH and the admin PATCH: validate the two
// structured columns a request body carries and return only the fields it sent.
// { ok: true, values: { field?, skills? } } or { ok: false, message }.
export async function validateJobVocabulary(body) {
  const values = {};
  if (body?.field !== undefined) {
    const field = await canonicalizeField(body.field);
    if (!field.ok) return { ok: false, message: 'field must be a listed job field' };
    values.field = field.value;
  }
  if (body?.skills !== undefined) {
    if (body.skills !== null && !Array.isArray(body.skills)) {
      return { ok: false, message: 'skills must be an array' };
    }
    const skills = await canonicalizeSkills(body.skills ?? []);
    if (!skills.ok) return { ok: false, message: `skills must contain at most ${MAX_SKILLS} values` };
    values.skills = skills.value;
  }
  return { ok: true, values };
}
