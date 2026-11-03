import { PortalShell } from "@/components/layout/portal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Employer Workspace",
  robots: { index: false, follow: false },
};

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell role="employer">{children}</PortalShell>;
}
