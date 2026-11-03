import { notFound } from "next/navigation";
import { EmploymentTracking } from "@/components/tracking/employment-tracking";
import { EmployerDashboard } from "@/components/employer/dashboard";
import { EmployerAccreditation } from "@/components/employer/accreditation";
import { CompanyProfile } from "@/components/employer/company-profile";
import { NotificationsPage } from "@/components/dashboard/notifications-page";
import { AccountSettings } from "@/components/dashboard/account-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (await params).section === "employees-tracking"
    ? {
        title: "Employees Tracking | JobLinked",
        description:
          "Manage verified company employment records, status history, and employee tracking.",
      }
    : {};
}

export default async function EmployerSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "employees-tracking":
      return <EmploymentTracking mode="employer" />;
    case "dashboard":
      return <EmployerDashboard />;
    case "accreditation":
      return <EmployerAccreditation />;
    case "profile":
      return <CompanyProfile />;
    case "notifications":
      return <NotificationsPage />;
    case "settings":
      return <AccountSettings />;
    default:
      notFound();
  }
}
