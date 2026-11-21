export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_HINT = "At least 8 characters, including one letter, one number, and one symbol.";

// Live checklist rules. Same regexes as passwordError; the 72-char maximum
// stays a submit-time error only.
export const PASSWORD_RULES = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { id: "letter", label: "One letter", test: (value) => /[a-z]/i.test(value) },
  { id: "number", label: "One number", test: (value) => /[0-9]/.test(value) },
  { id: "symbol", label: "One symbol (e.g. ! @ # $)", test: (value) => /[^a-z0-9\s]/i.test(value) },
];

// Returns '' when the password is acceptable, otherwise the first failing rule.
export function passwordError(value) {
  if (!value) return "Password is required";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  // A symbol is anything that is not a letter, a digit, or whitespace.
  if (!/[a-z]/i.test(value) || !/[0-9]/.test(value) || !/[^a-z0-9\s]/i.test(value)) {
    return "Password must include at least one letter, one number, and one symbol.";
  }
  return "";
}
