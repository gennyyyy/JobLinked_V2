// 8–72 characters with at least one letter, one number, and one symbol.
// Deliberately duplicated from src/shared/utils/password.js (Decision 11): the
// client is not the trust boundary, and server code must not import across the
// client/server boundary. Keep the messages identical; both copies are pinned
// by the same cases.
export function passwordPolicyError(value) {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 72) return 'Password must be at most 72 characters';
  // A symbol is anything that is not a letter, a digit, or whitespace.
  if (!/[a-z]/i.test(value) || !/[0-9]/.test(value) || !/[^a-z0-9\s]/i.test(value)) {
    return 'Password must include at least one letter, one number, and one symbol.';
  }
  return '';
}
