import { PortalShell } from "@/components/layout/portal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PESO Admin Workspace",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell role="admin">{children}</PortalShell>;
}
