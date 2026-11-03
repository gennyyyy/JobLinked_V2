import { notFound } from "next/navigation";
import { EmploymentTracking } from "@/components/tracking/employment-tracking";
import { JobSeekerDashboard } from "@/components/jobseeker/dashboard";
import { JobSeekerProfile } from "@/components/jobseeker/profile";
import { JobSeekerOpportunities } from "@/components/jobseeker/opportunities";
import { NotificationsPage } from "@/components/dashboard/notifications-page";
import { AccountSettings } from "@/components/dashboard/account-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (await params).section === "employment-tracking"
    ? {
        title: "Employment Tracking | JobLinked",
        description:
          "View your JobLinked employment records, recorded milestones, and correction requests.",
      }
    : {};
}

export default async function JobSeekerSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "employment-tracking":
      return <EmploymentTracking mode="jobseeker" />;
    case "dashboard":
      return <JobSeekerDashboard />;
    case "profile":
      return <JobSeekerProfile />;
    case "recommended":
      return <JobSeekerOpportunities />;
    case "saved":
      return <JobSeekerOpportunities saved />;
    case "notifications":
      return <NotificationsPage />;
    case "settings":
      return <AccountSettings />;
    default:
      notFound();
  }
}
