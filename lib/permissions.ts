import type {
  DemoState,
  Permission,
  PermissionMatrix,
  User,
  UserRole,
} from "@/types";
export const USER_ROLES: UserRole[] = [
  "jobseeker",
  "employer",
  "admin",
  "staff",
];
export const PERMISSIONS: { key: Permission; label: string }[] = [
  { key: "browse", label: "Browse Jobs" },
  { key: "apply", label: "Submit Applications" },
  { key: "jobs", label: "Manage Job Postings" },
  { key: "employees", label: "Track Employees" },
  { key: "accreditation", label: "Review Accreditation" },
  { key: "reports", label: "Generate Reports" },
  { key: "roles", label: "Manage User Roles" },
];
export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  jobseeker: {
    browse: "all",
    apply: "own",
    jobs: "none",
    employees: "own",
    accreditation: "none",
    reports: "none",
    roles: "none",
  },
  employer: {
    browse: "all",
    apply: "none",
    jobs: "company",
    employees: "company",
    accreditation: "none",
    reports: "company",
    roles: "none",
  },
  admin: {
    browse: "all",
    apply: "none",
    jobs: "all",
    employees: "all",
    accreditation: "all",
    reports: "all",
    roles: "all",
  },
  staff: {
    browse: "all",
    apply: "none",
    jobs: "assigned",
    employees: "assigned",
    accreditation: "none",
    reports: "none",
    roles: "none",
  },
};
export function hasPermission(
  state: DemoState,
  user: User | null | undefined,
  permission: Permission,
) {
  return (
    !!user?.active && state.permissionMatrix[user.role][permission] !== "none"
  );
}
export const portalRole = (role: UserRole) =>
  role === "staff" ? "admin" : role;
export function canOpenSection(state: DemoState, user: User, section: string) {
  if (user.role !== "staff")
    return section !== "role-management" || hasPermission(state, user, "roles");
  if (section === "notifications" || section === "dashboard") return true;
  const required = (
    {
      "employment-tracking": "employees",
      accreditation: "accreditation",
      reports: "reports",
    } as const
  )[section as "employment-tracking" | "accreditation" | "reports"];
  return !!required && hasPermission(state, user, required);
}
