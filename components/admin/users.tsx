"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  PageHeading,
  Panel,
  Notice,
  EmptyState,
  SelectField,
  TextField,
  StatusBadge,
} from "@/components/shared";
import { SearchInput } from "@/components/dashboard/list-controls";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { hasPermission, PERMISSIONS, USER_ROLES } from "@/lib/permissions";
import { ROLE_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import type { Permission, UserRole } from "@/types";
export function UserManagement() {
  const { state, user, api } = useDemo();
  const { run, pending } = useAction();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [access, setAccess] = useState("");
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState<UserRole>("jobseeker");
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [permission, setPermission] = useState<Permission | null>(null);
  if (!user || user.role !== "admin" || !hasPermission(state, user, "roles"))
    return (
      <EmptyState
        title="Administrator permission required"
        description="Only authorized PESO administrators may manage roles and account access."
      />
    );
  const target = state.users.find((u) => u.id === selected);
  const records = state.users.filter(
    (u) =>
      `${u.id} ${u.name} ${u.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || u.role === filter) &&
      (!access || u.active === (access === "Active")),
  );
  const stats = [
    ["Total system users", state.users.length],
    ["Job seekers", state.users.filter((u) => u.role === "jobseeker").length],
    ["Employers", state.users.filter((u) => u.role === "employer").length],
    [
      "PESO administrators",
      state.users.filter((u) => u.role === "admin").length,
    ],
    ["Active accounts", state.users.filter((u) => u.active).length],
    ["Suspended accounts", state.users.filter((u) => !u.active).length],
  ];
  return (
    <>
      <PageHeading
        eyebrow="Accountable access. Clear responsibilities."
        title="User Management"
        description="Find registered users, assign their system roles, and manage account access."
      />
      <Notice title="Frontend authorization preview">
        Role checks are enforced by shared mock services for this session, not a
        secure backend. Production must validate JWT sessions, permissions,
        tenant scope, and audit writes server-side.
      </Notice>
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, count]) => (
          <Panel key={label} title={String(label)}>
            <p className="text-2xl font-semibold text-navy">{count}</p>
          </Panel>
        ))}
      </div>
      <Panel
        title="System users"
        description="Your own elevated permissions cannot be modified. Job seeker and employer roles require an existing matching profile."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search user ID, name, or email…"
          />
          <SelectField
            label="Assigned role"
            value={filter}
            placeholder="All roles"
            options={USER_ROLES.map((value) => ({
              value,
              label: ROLE_LABELS[value],
            }))}
            onChange={(e) => setFilter(e.target.value)}
          />
          <SelectField
            label="Account status"
            value={access}
            placeholder="All accounts"
            options={["Active", "Suspended"]}
            onChange={(e) => setAccess(e.target.value)}
          />
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "User ID",
                  "Full name",
                  "Email address",
                  "Assigned role",
                  "Account status",
                  "Registered",
                  "Last updated",
                  "Actions",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="max-w-36 truncate" title={u.id}>
                    {u.id}
                  </TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.active ? "Active" : "Suspended"} />
                  </TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    {formatDate(u.updatedAt ?? u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(u.id);
                        setRole(u.role);
                        setActive(u.active);
                        setReason("");
                        setConfirmed(false);
                      }}
                    >
                      Manage access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No users found"
            description="Try a different search or filter."
          />
        )}
      </Panel>
      <div className="mt-6">
        <Panel
          title="Role and access change history"
          description="Previous role, new role, responsible administrator, timestamp, and reason are retained."
        >
          {state.roleChangeLogs.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "User",
                    "Previous role",
                    "New role",
                    "Access",
                    "Administrator",
                    "Timestamp",
                    "Reason",
                  ].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.roleChangeLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {state.users.find((u) => u.id === log.userId)?.name}
                    </TableCell>
                    <TableCell>{ROLE_LABELS[log.previousRole]}</TableCell>
                    <TableCell>{ROLE_LABELS[log.newRole]}</TableCell>
                    <TableCell>
                      {log.previousActive ? "Active" : "Suspended"} →{" "}
                      {log.newActive ? "Active" : "Suspended"}
                    </TableCell>
                    <TableCell>
                      {
                        state.users.find((u) => u.id === log.administratorId)
                          ?.name
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(log.timestamp).toLocaleString("en-PH")}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal break-words">
                      {log.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No access changes yet"
              description="Confirmed role and account changes will appear here."
            />
          )}
        </Panel>
      </div>
      <Dialog
        open={!!target || !!permission}
        onOpenChange={(open) => {
          if (!open) {
            setSelected("");
            setPermission(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {permission
                ? "Configure restricted staff permission"
                : `Manage ${target?.name}`}
            </DialogTitle>
            <DialogDescription>
              {permission
                ? "Toggle this scoped permission. This never grants unrestricted administrator access."
                : "Confirm the role and account state before applying. Every change requires a reason and is audited."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (permission)
                  await api.setStaffPermission(
                    permission,
                    state.permissionMatrix.staff[permission] === "none",
                    reason,
                    confirmed,
                  );
                else if (target)
                  await api.updateAccess(
                    target.id,
                    role,
                    active,
                    reason,
                    confirmed,
                  );
                setSelected("");
                setPermission(null);
              }, "Access configuration updated.");
            }}
          >
            <FieldGroup>
              {target && (
                <>
                  <TextField label="User ID" readOnly value={target.id} />
                  <SelectField
                    label="Assigned system role"
                    value={role}
                    disabled={target.id === user.id}
                    options={USER_ROLES.filter(
                      (r) =>
                        r === "admin" ||
                        r === "staff" ||
                        (r === "jobseeker" &&
                          state.seekers.some((s) => s.id === target.id)) ||
                        (r === "employer" &&
                          state.employers.some((e) => e.userId === target.id)),
                    ).map((value) => ({ value, label: ROLE_LABELS[value] }))}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                  />
                  <SelectField
                    label="Account access"
                    value={active ? "Active" : "Suspended"}
                    disabled={target.id === user.id}
                    options={["Active", "Suspended"]}
                    onChange={(e) => setActive(e.target.value === "Active")}
                  />
                </>
              )}
              {permission && (
                <p className="text-sm">
                  {PERMISSIONS.find((p) => p.key === permission)?.label}:{" "}
                  {state.permissionMatrix.staff[permission] === "none"
                    ? "Enable scoped access"
                    : "Disable staff access"}
                </p>
              )}
              <TextField
                label="Reason for change"
                multiline
                minLength={10}
                maxLength={2000}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Field orientation="horizontal">
                <Checkbox
                  id="confirm-access"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                <FieldLabel htmlFor="confirm-access">
                  I confirm this role or permission change.
                </FieldLabel>
              </Field>
              <Button
                type="submit"
                disabled={pending || !confirmed || target?.id === user.id}
              >
                Confirm access change
              </Button>
            </FieldGroup>
          </form>
          {target && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Account role history</h3>
              {state.roleChangeLogs
                .filter((l) => l.userId === target.id)
                .map((l) => (
                  <p className="text-xs" key={l.id}>
                    {ROLE_LABELS[l.previousRole]} → {ROLE_LABELS[l.newRole]} ·{" "}
                    {formatDate(l.timestamp)} · {l.reason}
                  </p>
                ))}
              {!state.roleChangeLogs.some((l) => l.userId === target.id) && (
                <p className="text-xs text-muted-foreground">
                  No recorded changes.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
