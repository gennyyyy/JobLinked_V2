import { api } from '../lib/api';

// Seeker profile children (Addendum A). Identity comes from the session
// token — the admin variants below are the only cross-seeker reads.
export async function listEducation() {
  return api.get('seekers/me/education');
}

export async function addEducation(entry) {
  return api.post('seekers/me/education', entry);
}

export async function removeEducation(id) {
  return api.del(`seekers/me/education/${id}`);
}

export async function listExperience() {
  return api.get('seekers/me/experience');
}

export async function addExperience(entry) {
  return api.post('seekers/me/experience', entry);
}

export async function removeExperience(id) {
  return api.del(`seekers/me/experience/${id}`);
}

export async function listEmployment() {
  return api.get('seekers/me/employment');
}

export async function listSeekerEducation(seekerId) {
  return api.get(`applications/seekers/${seekerId}/education`);
}

export async function listSeekerExperience(seekerId) {
  return api.get(`applications/seekers/${seekerId}/experience`);
}
