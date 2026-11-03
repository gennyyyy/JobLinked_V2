"use client";

import { PageHeading, Panel, EmptyState, Notice } from "@/components/shared";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useDemo } from "@/hooks/use-demo";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABELS } from "@/constants";

const PREDEFINED_ROLES = ["admin", "jobseeker", "employer"] as const;

export function RoleManagement() {
  const { state, user } = useDemo();
  if (!user || user.role !== "admin" || !hasPermission(state, user, "roles")) {
    return <EmptyState title="Administrator permission required" description="Only authorized PESO administrators may manage roles." />;
  }
  return <>
    <PageHeading eyebrow="Clear responsibilities" title="Role Management" description="Manage role definitions here. Assign roles to individual accounts in User Management." />
    <div className="flex flex-col gap-6">
      <Panel title="Predefined roles" description="The three system roles define each account’s workspace and access.">
        <div className="grid gap-4 sm:grid-cols-3">
          {PREDEFINED_ROLES.map(role => <div key={role} className="rounded-xl border p-5"><h2 className="font-semibold">{ROLE_LABELS[role]}</h2><p className="mt-2 text-sm text-muted-foreground">{role === "admin" ? "PESO administration and system oversight." : role === "jobseeker" ? "Job search, applications, and employment tracking." : "Company profile, job postings, applicants, and employees."}</p></div>)}
        </div>
        <div className="mt-6 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Permission</TableHead>{PREDEFINED_ROLES.map(role => <TableHead key={role}>{ROLE_LABELS[role]}</TableHead>)}</TableRow></TableHeader><TableBody>{PERMISSIONS.map(permission => <TableRow key={permission.key}><TableCell>{permission.label}</TableCell>{PREDEFINED_ROLES.map(role => <TableCell key={role}>{state.permissionMatrix[role][permission.key]}</TableCell>)}</TableRow>)}</TableBody></Table></div>
      </Panel>
      <Panel title="Custom roles" description="Additional role definitions will appear here, separate from the three predefined roles.">
        <Notice title="Database connection required">Custom role creation and editing require persistent storage and server-side permission checks. No database is connected yet; custom roles cannot be saved in this .</Notice>
      </Panel>
    </div>
  </>;
}
