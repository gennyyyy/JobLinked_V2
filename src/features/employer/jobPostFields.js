import { JOB_EXPERIENCE_PRESETS } from "../../shared/constants";

export const POSTING_LABELS = {
  draft: 'Draft',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
}
export const POSTING_STATUSES = Object.entries(POSTING_LABELS).map(([value, label]) => ({ value, label }))
export const ACCREDITATION_LABELS = {
  none: 'Pending Review',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  resubmission: 'Resubmission Requested',
  revoked: 'Revoked',
}
export const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

export const initialForm = {
  title: "",
  office: "",
  description: "",
  requirements: "",
  salary_min: "",
  salary_max: "",
  employment_type: "Full-time",
  location: "",
  vacancies: 1,
  deadline: "",
  instructions: "",
  benefits: [],
  tags: [],
  work_arrangement: "On-site",
};

// ponytail: education is a prefixed line inside requirements text; promote to a real column only if it must be filtered/matched.
const EDUCATION_LINE = /^\s*Education:\s*(.*)$/;

export function parseEducation(requirements) {
  const match = (requirements || "").split("\n").find((line) => EDUCATION_LINE.test(line));
  return match ? match.match(EDUCATION_LINE)[1].trim() : "";
}

export function applyEducation(requirements, level) {
  const others = (requirements || "").split("\n").filter((line) => !EDUCATION_LINE.test(line));
  const lines = level ? [`Education: ${level}`, ...others] : others;
  return lines.join("\n").trim();
}

// ponytail: experience is a prefixed line inside requirements text; promote to a real column only if it must be filtered/matched.
const EXPERIENCE_LINE = /^\s*Experience:\s*(?:No experience required|(\d+))/i;

export function parseExperience(requirements) {
  const line = String(requirements || "").split("\n").find((l) => EXPERIENCE_LINE.test(l));
  if (!line) return "";
  const m = line.match(EXPERIENCE_LINE);
  return m[1] ? m[1] : "0";
}

export function applyExperience(requirements, years) {
  const lines = String(requirements || "").split("\n").filter((l) => l.trim() && !EXPERIENCE_LINE.test(l));
  if (years !== "" && years !== undefined && years !== null) {
    const n = Number(years);
    lines.unshift(n === 0 ? "Experience: No experience required" : `Experience: ${n} year${n === 1 ? "" : "s"}`);
  }
  return lines.join("\n");
}

export const EXPERIENCE_OPTIONS = [
  { value: "0", label: "No experience required" },
  ...JOB_EXPERIENCE_PRESETS.filter((n) => n !== 0).map((n) => ({ value: String(n), label: `${n} year${n === 1 ? "" : "s"}` })),
  { value: "custom", label: "Custom…" },
];

export function formatSalary(min, max) {
  if (!min && !max) return "Not disclosed";
  if (min && max) {
    return `₱${Number(min).toLocaleString()} - ₱${Number(max).toLocaleString()}`;
  }
  if (min) return `From ₱${Number(min).toLocaleString()}`;
  return `Up to ₱${Number(max).toLocaleString()}`;
}
