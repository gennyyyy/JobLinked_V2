import { mutate } from "swr";
import { DEMO_ACCOUNTS, DEMO_QUERY_KEY, STORAGE_KEY } from "@/constants";
import { createInitialState } from "./fixtures";
import { ensureEmployment } from "./tracking";
import type { DemoState, JobPosting, Role } from "@/types";

let state: DemoState | undefined;
export const wait = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 100));
export const now = () => new Date().toISOString();
export const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function current(): DemoState {
  if (typeof window === "undefined") return createInitialState();
  if (!state) {
    state = createInitialState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version === 1 || saved.version === 2) {
          const knownEmployers = new Set(state.employers.map((e) => e.id));
          const knownSeekers = new Set(state.seekers.map((s) => s.id));
          if (Array.isArray(saved.jobs)) {
            const savedJobs = saved.jobs.filter(
              (j: JobPosting) =>
                knownEmployers.has(j.employerId) &&
                typeof j.title === "string" &&
                Array.isArray(j.skills),
            );
            const savedJobIds = new Set(savedJobs.map((job: JobPosting) => job.id));
            state.jobs = [
              ...savedJobs,
              ...state.jobs.filter((job) => !savedJobIds.has(job.id)),
            ];
          }
          if (Array.isArray(saved.applications))
            state.applications = saved.applications
              .filter(
                (a: { seekerId: string; jobId: string }) =>
                  knownSeekers.has(a.seekerId) &&
                  state!.jobs.some((j) => j.id === a.jobId),
              )
              .map((a: DemoState["applications"][number]) => ({
                ...a,
                resumeName: "Sample resume · metadata not retained",
                coverLetter: "",
                notes: [],
              }));
          for (const seeker of state.seekers)
            if (Array.isArray(saved.savedJobs?.[seeker.id]))
              seeker.savedJobIds = saved.savedJobs[seeker.id];
          for (const employer of state.employers) {
            const status = saved.accreditations?.[employer.id];
            if (
              [
                "Approved",
                "Pending Review",
                "Rejected",
                "Resubmission Requested",
              ].includes(status)
            ) {
              employer.accreditationStatus = status;
              const accreditation = state.accreditations.find(
                (a) => a.employerId === employer.id,
              )!;
              accreditation.status = status;
              accreditation.feedback =
                status === "Approved"
                  ? "Sample accreditation approved."
                  : status === "Pending Review"
                    ? ""
                    : "A sample review decision was saved. Review requirements and resubmit.";
            }
          }
          if (Array.isArray(saved.announcements))
            state.announcements = saved.announcements;
        }
      }
      const selected =
        sessionStorage.getItem("joblinked-preview-user") ??
        localStorage.getItem("joblinked-remember-preview");
      if (DEMO_ACCOUNTS.some((a) => a.id === selected))
        state.sessionUserId = selected;
    } catch {
      /* Storage is optional; the demo remains usable in memory. */
    }
  }
  for (const application of state.applications)
    if (application.status === "Hired") ensureEmployment(state, application.id);
  return state;
}
function persist() {
  if (typeof window === "undefined" || !state) return;
  try {
    const seed = createInitialState();
    const companies = new Set(seed.employers.map((e) => e.id));
    const seekers = new Set(seed.seekers.map((s) => s.id));
    const jobs = state.jobs.filter((j) => companies.has(j.employerId));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        jobs,
        applications: state.applications
          .filter(
            (a) =>
              seekers.has(a.seekerId) && jobs.some((j) => j.id === a.jobId),
          )
          .map((a) => ({
            id: a.id,
            jobId: a.jobId,
            seekerId: a.seekerId,
            status: a.status,
            submittedAt: a.submittedAt,
            referred: a.referred,
            timeline: a.timeline.map((event) => ({
              status: event.status,
              date: event.date,
              description:
                "Sample status retained. Private submission and interview details are not saved.",
            })),
          })),
        savedJobs: Object.fromEntries(
          state.seekers
            .filter((s) => seekers.has(s.id))
            .map((s) => [s.id, s.savedJobIds]),
        ),
        accreditations: Object.fromEntries(
          state.employers
            .filter((e) => companies.has(e.id))
            .map((e) => [e.id, e.accreditationStatus]),
        ),
        announcements: state.announcements,
      }),
    );
  } catch {
    /* No credentials, registration profiles, or uploaded files are persisted. */
  }
}
export async function commit(change: (draft: DemoState) => void) {
  await wait();
  const draft = structuredClone(current());
  change(draft);
  draft.revision++;
  state = draft;
  persist();
  await mutate(DEMO_QUERY_KEY, state, { revalidate: false });
}
export function requireUser(s: DemoState, role?: Role) {
  const actor = s.users.find((u) => u.id === s.sessionUserId);
  if (!actor || !actor.active)
    throw new Error("Choose an active demo account to continue.");
  if (role && actor.role !== role)
    throw new Error("This action is not available for this demo role.");
  return actor;
}
export function requireEmployer(s: DemoState) {
  const actor = requireUser(s, "employer");
  const company = s.employers.find((e) => e.userId === actor.id);
  if (!company) throw new Error("Company profile not found.");
  return company;
}
export function audit(s: DemoState, action: string, target: string) {
  s.auditLogs.unshift({
    id: makeId("audit"),
    actor: requireUser(s).name,
    action,
    target,
    date: now(),
  });
}
export function notify(
  s: DemoState,
  userId: string,
  title: string,
  message: string,
  href: string,
  type: DemoState["notifications"][number]["type"] = "application",
) {
  const preferences = s.userPreferences?.[userId];
  if (
    preferences &&
    (type === "announcement"
      ? !preferences.announcements
      : !preferences.applicationUpdates)
  )
    return;
  s.notifications.unshift({
    id: makeId("notification"),
    userId,
    title,
    message,
    date: now(),
    read: false,
    href,
    type,
  });
}
export function rememberUser(userId: string | null, remember = false) {
  try {
    if (userId && DEMO_ACCOUNTS.some((a) => a.id === userId)) {
      sessionStorage.setItem("joblinked-preview-user", userId);
      if (remember) localStorage.setItem("joblinked-remember-preview", userId);
      else localStorage.removeItem("joblinked-remember-preview");
    } else {
      sessionStorage.removeItem("joblinked-preview-user");
      localStorage.removeItem("joblinked-remember-preview");
    }
  } catch {
    /* Role selection works without browser storage. */
  }
}
export async function resetStore() {
  state = createInitialState();
  try {
    localStorage.removeItem(STORAGE_KEY);
    rememberUser(null);
  } catch {
    /* In-memory reset still works. */
  }
  await mutate(DEMO_QUERY_KEY, state, { revalidate: false });
}
