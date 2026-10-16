// Strict +63 storage for PH numbers: typed 09… / 63… / +63… (spaces,
// dashes) all normalize to +63XXXXXXXXXX on submit; anything else fails.
// ponytail: 9-10 digits after +63 covers mobile (10) + landline (9); tighten if backend ever enforces E.164.
export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("63") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^\d{9,10}$/.test(local)) return String(value).trim();
  return `+63${local}`;
}

export function isValidPhone(value) {
  return /^\+63\d{9,10}$/.test(normalizePhone(value));
}

// Digits after the fixed +63 prefix: strips non-digits, a pasted 63/0
// trunk, caps at 10. "" when empty so required-checks still fire.
export function toLocalDigits(value) {
  let d = String(value ?? "").replace(/\D/g, "");
  if (d.startsWith("63")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

export function withPrefix(value) {
  const l = toLocalDigits(value);
  return l ? `+63${l}` : "";
}
