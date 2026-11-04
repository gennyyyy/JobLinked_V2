import { api, apiAssetUrl } from '../lib/api';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_INPUT = 10 * 1024 * 1024; // reject absurd files before decoding
const MAX_EDGE = 512;

// Downscale before upload: a phone photo is 3–8 MB, and profile images are
// stored as bytes in Postgres (ADR-040). 512 px JPEG keeps them ~30–120 KB.
export async function resizeImage(file) {
  if (!file) throw new Error('Choose an image first.');
  if (!ALLOWED.includes(file.type)) throw new Error('Use a PNG, JPG, or WEBP image.');
  if (file.size > MAX_INPUT) throw new Error('That image is too large. Choose one under 10 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // JPEG has no alpha; paint white so transparent PNGs do not turn black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Could not process that image.'))), 'image/jpeg', 0.85);
  });
  const name = String(file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
}

async function upload(path, file) {
  const resized = await resizeImage(file);
  const form = new FormData();
  form.append('file', resized, resized.name);
  return api.post(path, form);
}

export const uploadAvatar = (file) => upload('seekers/me/avatar', file);
export const removeAvatar = () => api.del('seekers/me/avatar');
export const uploadLogo = (file) => upload('employers/me/logo', file);
export const removeLogo = () => api.del('employers/me/logo');

// The avatar endpoint requires the bearer token, so it cannot be an <img src>;
// fetch the bytes and hand the page an object URL (caller revokes it).
export async function fetchAvatarObjectUrl(userId) {
  if (!userId) return null;
  try {
    return URL.createObjectURL(await api.blob(`seekers/${userId}/avatar`));
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

// Public business branding: a plain URL, no token needed.
export const logoUrl = (employerId, version) => apiAssetUrl(
  `employers/${employerId}/logo${version ? `?v=${encodeURIComponent(version)}` : ''}`,
);
