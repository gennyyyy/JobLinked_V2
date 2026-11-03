import type {
  DemoState,
  EmployeeTrackingRecord,
  EmploymentStatus,
  Permission,
  UserRole,
} from "@/types";
import {
  hasPermission,
  DEFAULT_PERMISSIONS,
  USER_ROLES,
} from "@/lib/permissions";
import {
  audit,
  commit,
  makeId,
  notify,
  now,
  requireEmployer,
  requireUser,
} from "./store";
export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "Hired — Pending Start",
  "Active",
  "Probationary",
  "Regular",
  "Contractual",
  "Resigned",
  "Terminated",
  "Contract Completed",
];
export const ended = (status: EmploymentStatus) =>
  ["Resigned", "Terminated", "Contract Completed"].includes(status);
export function ensureEmployment(s: DemoState, applicationId: string) {
  if (s.employmentRecords.some((r) => r.applicationId === applicationId))
    return;
  const a = s.applications.find((a) => a.id === applicationId);
  const job = s.jobs.find((j) => j.id === a?.jobId);
  if (!a || !job || a.status !== "Hired") return;
  const date = a.timeline.find((e) => e.status === "Hired")?.date ?? now();
  s.employmentRecords.push({
    id: makeId("employee"),
    applicationId,
    seekerId: a.seekerId,
    employerId: job.employerId,
    position: job.title,
    department: "Not yet specified",
    hiredAt: date,
    startDate: null,
    endDate: null,
    classification: job.type,
    status: "Hired — Pending Start",
    updatedAt: date,
    assignedStaffIds: [],
    history: [
      {
        id: makeId("history"),
        status: "Hired — Pending Start",
        effectiveDate: date.slice(0, 10),
        recordedAt: date,
        actorId: s.employers.find((e) => e.id === job.employerId)!.userId,
        remarks: "Hiring confirmed through JobLinked.",
      },
    ],
  });
  notify(
    s,
    a.seekerId,
    "Your employment record is ready",
    job.title,
    "/jobseeker/employment-tracking",
  );
}
export function visibleEmployment(s: DemoState) {
  const actor = s.users.find((u) => u.id === s.sessionUserId);
  if (!hasPermission(s, actor, "employees")) return [];
  return s.employmentRecords.filter(
    (r) =>
      actor!.role === "admin" ||
      (actor!.role === "staff"
        ? r.assignedStaffIds.includes(actor!.id)
        : actor!.role === "jobseeker"
          ? r.seekerId === actor!.id
          : s.employers.some(
              (e) =>
                e.id === r.employerId &&
                e.userId === actor!.id &&
                e.accreditationStatus === "Approved",
            )),
  );
}
function rolesAdmin(s: DemoState) {
  const actor = requireUser(s, "admin");
  if (!hasPermission(s, actor, "roles"))
    throw new Error("Role management permission required.");
  return actor;
}
export const trackingActions = {
  async updateEmployment(
    id: string,
    input: {
      status: EmploymentStatus;
      effectiveDate: string;
      remarks: string;
      department: string;
      classification: string;
      confirmed: boolean;
    },
  ) {
    await commit((s) => {
      const actor = requireUser(s, "employer");
      const company = requireEmployer(s);
      const r = s.employmentRecords.find(
        (r) => r.id === id && r.employerId === company.id,
      );
      if (
        !r ||
        company.accreditationStatus !== "Approved" ||
        !hasPermission(s, actor, "employees")
      )
        throw new Error(
          "Only your verified company may update this employment.",
        );
      if (
        !input.confirmed ||
        !EMPLOYMENT_STATUSES.includes(input.status) ||
        input.remarks.trim().length < 10 ||
        input.remarks.length > 2000
      )
        throw new Error(
          "Confirm the change and provide a reason of 10–2,000 characters.",
        );
      const date = input.effectiveDate;
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      });
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        date > today ||
        date < r.hiredAt.slice(0, 10) ||
        date < r.history.at(-1)!.effectiveDate
      )
        throw new Error(
          "Use a valid date from the latest employment event through today. Future changes cannot be applied yet.",
        );
      if (new Date(date).toISOString().slice(0, 10) !== date)
        throw new Error("Choose a valid calendar date.");
      if (r.startDate && input.status === "Hired — Pending Start")
        throw new Error(
          "An employee who has started cannot return to pending start.",
        );
      if (ended(r.status))
        throw new Error(
          "A separated record is historical and cannot be reopened.",
        );
      if (!input.department.trim() || !input.classification.trim())
        throw new Error(
          "Department and employment classification are required.",
        );
      const timestamp = now();
      r.status = input.status;
      r.department = input.department.trim().slice(0, 100);
      r.classification = input.classification.trim().slice(0, 100);
      r.updatedAt = timestamp;
      if (
        !ended(r.status) &&
        r.status !== "Hired — Pending Start" &&
        !r.startDate
      )
        r.startDate = date;
      if (ended(r.status)) r.endDate = date;
      r.history.push({
        id: makeId("history"),
        status: r.status,
        effectiveDate: date,
        recordedAt: timestamp,
        actorId: actor.id,
        remarks: input.remarks.trim(),
      });
      notify(
        s,
        r.seekerId,
        `Employment update: ${r.status}`,
        `${company.name} · ${r.position}. Effective ${date}.`,
        "/jobseeker/employment-tracking",
      );
      audit(
        s,
        `Employment status: ${r.status} (${date}) — ${input.remarks.trim()}`,
        r.id,
      );
    });
    return true;
  },
  async requestCorrection(id: string, message: string) {
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const r = s.employmentRecords.find(
        (r) => r.id === id && r.seekerId === actor.id,
      );
      if (!r) throw new Error("Employment record unavailable.");
      if (message.trim().length < 10 || message.length > 2000)
        throw new Error("Describe the correction in 10–2,000 characters.");
      if (
        s.correctionRequests.some(
          (c) => c.employmentId === id && c.status === "Pending",
        )
      )
        throw new Error("An open request already exists for this record.");
      s.correctionRequests.unshift({
        id: makeId("correction"),
        employmentId: id,
        seekerId: actor.id,
        message: message.trim(),
        createdAt: now(),
        status: "Pending",
      });
      s.users
        .filter((u) => u.active && u.role === "admin")
        .forEach((u) =>
          notify(
            s,
            u.id,
            "Employment correction requested",
            `${actor.name} submitted a correction request.`,
            "/admin/employment-tracking",
          ),
        );
      audit(s, "Requested employment correction", id);
    });
    return true;
  },
  async reviewCorrection(id: string, resolution: string) {
    await commit((s) => {
      const actor = requireUser(s, "admin");
      if (!hasPermission(s, actor, "employees"))
        throw new Error("Oversight access required.");
      const c = s.correctionRequests.find(
        (c) => c.id === id && c.status === "Pending",
      );
      if (!c || resolution.trim().length < 10)
        throw new Error(
          "Select an open request and provide a resolution of at least 10 characters.",
        );
      c.status = "Reviewed";
      c.resolution = resolution.trim();
      c.reviewedBy = actor.id;
      notify(
        s,
        c.seekerId,
        "Correction request reviewed",
        c.resolution,
        "/jobseeker/employment-tracking",
      );
      audit(s, `Reviewed correction: ${c.resolution}`, c.employmentId);
    });
    return true;
  },
  async updateAccess(
    id: string,
    role: UserRole,
    active: boolean,
    reason: string,
    confirmed: boolean,
  ) {
    await commit((s) => {
      const actor = rolesAdmin(s);
      const target = s.users.find((u) => u.id === id);
      if (!target || !USER_ROLES.includes(role))
        throw new Error("Account or role not found.");
      if (actor.id === id)
        throw new Error("You cannot change your own role or access.");
      if (!confirmed || reason.trim().length < 10)
        throw new Error(
          "Confirmation and a reason of at least 10 characters are required.",
        );
      if (
        (role === "jobseeker" && !s.seekers.some((p) => p.id === id)) ||
        (role === "employer" && !s.employers.some((p) => p.userId === id))
      )
        throw new Error("This role requires an existing matching profile.");
      if (
        target.role === "admin" &&
        target.active &&
        (!active || role !== "admin") &&
        s.users.filter((u) => u.role === "admin" && u.active).length <= 1
      )
        throw new Error("The last active administrator must be retained.");
      const timestamp = now();
      s.roleChangeLogs.unshift({
        id: makeId("role-audit"),
        userId: id,
        previousRole: target.role,
        newRole: role,
        administratorId: actor.id,
        timestamp,
        reason: reason.trim(),
        previousActive: target.active,
        newActive: active,
      });
      target.role = role;
      target.active = active;
      target.updatedAt = timestamp;
      const profile = s.seekers.find((p) => p.id === id);
      if (profile) profile.active = active;
      audit(s, `Role/access changed: ${reason.trim()}`, target.name);
    });
    return true;
  },
  async setStaffPermission(
    permission: Permission,
    enabled: boolean,
    reason: string,
    confirmed: boolean,
  ) {
    await commit((s) => {
      rolesAdmin(s);
      if (
        !["employees", "browse", "accreditation", "reports"].includes(
          permission,
        )
      )
        throw new Error(
          "This permission cannot be elevated for restricted staff.",
        );
      if (!confirmed || reason.trim().length < 10)
        throw new Error("Confirmation and a reason are required.");
      s.permissionMatrix.staff[permission] = enabled
        ? permission === "accreditation" || permission === "reports"
          ? "all"
          : DEFAULT_PERMISSIONS.staff[permission]
        : "none";
      audit(
        s,
        `Staff permission ${permission}: ${enabled ? "enabled" : "disabled"} — ${reason}`,
        "PESO Staff",
      );
    });
    return true;
  },
  async assignStaff(id: string, staffId: string) {
    await commit((s) => {
      rolesAdmin(s);
      const r = s.employmentRecords.find((r) => r.id === id);
      if (
        !r ||
        !s.users.some((u) => u.id === staffId && u.active && u.role === "staff")
      )
        throw new Error("Select an active staff account and valid record.");
      r.assignedStaffIds = [staffId];
      audit(s, "Assigned employment oversight", `${id}: ${staffId}`);
    });
    return true;
  },
};
