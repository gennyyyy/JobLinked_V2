import { notFound } from "next/navigation";
import { EmploymentTracking } from "@/components/tracking/employment-tracking";
import { RoleManagement } from "@/components/admin/role-management";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminProfile } from "@/components/admin/profile";
import { AdminAccreditations } from "@/components/admin/accreditation";
import { UserManagement } from "@/components/admin/users";
import { VacancyOversight } from "@/components/admin/vacancies";
import { ApplicationMonitoring } from "@/components/admin/monitoring";
import { LaborMarketReports } from "@/components/admin/reports";
import { AnnouncementManagement } from "@/components/admin/announcements";
import { AuditLogPage } from "@/components/admin/audit-log";
import { NotificationsPage } from "@/components/dashboard/notifications-page";
import { AccountSettings } from "@/components/dashboard/account-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const section = (await params).section;
  return section === "role-management"
    ? {
        title: "Role Management | JobLinked",
        description:
          "Manage PESO roles, scoped permissions, account access, and administrative audit history.",
      }
    : section === "employment-tracking"
      ? { title: "Employment Oversight | JobLinked" }
      : {};
}

export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "role-management":
      return <RoleManagement />;
    case "employment-tracking":
      return <EmploymentTracking mode="admin" />;
    case "dashboard":
      return <AdminDashboard />;
    case "profile":
      return <AdminProfile />;
    case "accreditation":
      return <AdminAccreditations />;
    case "users":
      return <UserManagement />;
    case "jobs":
      return <VacancyOversight />;
    case "applications":
      return <ApplicationMonitoring />;
    case "reports":
      return <LaborMarketReports />;
    case "announcements":
      return <AnnouncementManagement />;
    case "audit":
      return <AuditLogPage />;
    case "notifications":
      return <NotificationsPage />;
    case "settings":
      return <AccountSettings />;
    default:
      notFound();
  }
}
