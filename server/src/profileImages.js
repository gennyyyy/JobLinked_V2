import { pool } from './db.js';

// ADR-040: small images only (avatars, company logos). Bytes never touch the
// role rows, so `select *` profile/admin queries cannot serialize them.
export const IMAGE_KINDS = {
  'seeker-avatar': 'seeker-avatar',
  'employer-logo': 'employer-logo',
};

export const isImageKind = (kind) => Object.hasOwn(IMAGE_KINDS, kind);

export async function putImage(ownerId, kind, mime, bytes) {
  const { rows } = await pool.query(
    `insert into profile_images (owner_id, kind, mime, bytes, updated_at)
     values ($1,$2,$3,$4,now())
     on conflict (owner_id, kind) do update
       set mime = excluded.mime, bytes = excluded.bytes, updated_at = now()
     returning updated_at`,
    [ownerId, kind, mime, bytes]);
  return rows[0];
}

export async function getImage(ownerId, kind) {
  const { rows } = await pool.query(
    'select mime, bytes, updated_at from profile_images where owner_id = $1 and kind = $2',
    [ownerId, kind]);
  return rows[0] || null;
}

export async function deleteImage(ownerId, kind) {
  const { rowCount } = await pool.query(
    'delete from profile_images where owner_id = $1 and kind = $2',
    [ownerId, kind]);
  return rowCount > 0;
}
