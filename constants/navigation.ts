import {
  LayoutDashboard,
  UserRound,
  Search,
  Bookmark,
  ClipboardList,
  Bell,
  Settings,
  Building2,
  ShieldCheck,
  BriefcaseBusiness,
  Users,
  ChartNoAxesCombined,
  Megaphone,
  ScrollText,
  Handshake,
} from "lucide-react";
import type { Role } from "@/types";

export const PORTAL_NAV = {
  jobseeker: [
    { label: "Overview", path: "dashboard", icon: LayoutDashboard },
    { label: "My profile", path: "profile", icon: UserRound },
    { label: "Browse Jobs", path: "recommended", icon: Search },
    { label: "Saved jobs", path: "saved", icon: Bookmark },
    { label: "My applications", path: "applications", icon: ClipboardList },
    {
      label: "Employment Tracking",
      path: "employment-tracking",
      icon: BriefcaseBusiness,
    },
    { label: "Notifications", path: "notifications", icon: Bell },
    { label: "Account settings", path: "settings", icon: Settings },
  ],
  employer: [
    { label: "Overview", path: "dashboard", icon: LayoutDashboard },
    { label: "Accreditation", path: "accreditation", icon: ShieldCheck },
    { label: "Company profile", path: "profile", icon: Building2 },
    { label: "Job management", path: "jobs", icon: BriefcaseBusiness },
    { label: "Applicants", path: "applicants", icon: Users },
    {
      label: "Employees Tracking",
      path: "employees-tracking",
      icon: BriefcaseBusiness,
    },
    { label: "Notifications", path: "notifications", icon: Bell },
    { label: "Account settings", path: "settings", icon: Settings },
  ],
  admin: [
    { label: "Overview", path: "dashboard", icon: LayoutDashboard },
    { label: "My profile", path: "profile", icon: UserRound },
    {
      label: "Employer accreditation",
      path: "accreditation",
      icon: ShieldCheck,
    },
    { label: "User management", path: "users", icon: Users },
    { label: "Role Management", path: "role-management", icon: ShieldCheck },
    {
      label: "Employment oversight",
      path: "employment-tracking",
      icon: Handshake,
    },
    { label: "Job vacancy oversight", path: "jobs", icon: BriefcaseBusiness },
    {
      label: "Applications & placements",
      path: "applications",
      icon: Handshake,
    },
    { label: "Reports & insights", path: "reports", icon: ChartNoAxesCombined },
    { label: "Announcements", path: "announcements", icon: Megaphone },
    { label: "Audit log", path: "audit", icon: ScrollText },
    { label: "Notifications", path: "notifications", icon: Bell },
    { label: "System settings", path: "settings", icon: Settings },
  ],
} satisfies Record<
  Role,
  { label: string; path: string; icon: typeof LayoutDashboard }[]
>;
