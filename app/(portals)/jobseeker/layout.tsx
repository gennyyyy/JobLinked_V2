import { PortalShell } from "@/components/layout/portal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Seeker Workspace",
  robots: { index: false, follow: false },
};

export default function JobSeekerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell role="jobseeker">{children}</PortalShell>;
}
