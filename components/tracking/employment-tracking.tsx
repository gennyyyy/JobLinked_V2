"use client";
import { useState } from "react";
import { JOB_TYPES } from "@/constants";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { FieldGroup } from "@/components/ui/field";
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
import { downloadCsv, formatDate } from "@/lib/format";
import {
  visibleEmployment,
  EMPLOYMENT_STATUSES,
  ended,
} from "@/services/mock/tracking";
import { EmploymentDetail } from "./employment-detail";
export function EmploymentTracking({
  mode,
}: {
  mode: "employer" | "jobseeker" | "admin";
}) {
  const { state, user, employer, api } = useDemo();
  const { run, pending } = useAction();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [classification, setClassification] = useState("");
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState("");
  const [resolution, setResolution] = useState("");
  const [staff, setStaff] = useState("");
  const records = visibleEmployment(state).sort((a, b) =>
    b.hiredAt.localeCompare(a.hiredAt),
  );
  const record = records.find((r) => r.id === selected);
  const current = records.find((r) => !ended(r.status));
  const filtered = records.filter(
    (r) =>
      (!status || r.status === status) &&
      (!classification || r.classification === classification) &&
      `${r.id} ${r.position} ${r.department} ${state.users.find((u) => u.id === r.seekerId)?.name} ${state.employers.find((e) => e.id === r.employerId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const stats =
    mode === "jobseeker"
      ? [
          ["Current status", current?.status ?? "No active employment"],
          [
            "Current employer",
            state.employers.find((e) => e.id === current?.employerId)?.name ??
              "—",
          ],
          ["Current position", current?.position ?? "—"],
          [
            "Employment start",
            current?.startDate ? formatDate(current.startDate) : "Not recorded",
          ],
          ["Employment type", current?.classification ?? "—"],
        ]
      : [
          ["Total hired employees", records.length],
          [
            "Currently active employees",
            records.filter(
              (r) => !ended(r.status) && r.status !== "Hired — Pending Start",
            ).length,
          ],
          [
            "Probationary employees",
            records.filter((r) => r.status === "Probationary").length,
          ],
          [
            "Regular employees",
            records.filter((r) => r.status === "Regular").length,
          ],
          [
            "Resigned or separated",
            records.filter((r) => ended(r.status)).length,
          ],
        ];
  if (mode === "employer" && employer?.accreditationStatus !== "Approved")
    return (
      <EmptyState
        title="Company verification required"
        description="Only approved employers may access employee tracking."
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="Beyond the hiring journey"
        title={
          mode === "employer"
            ? "Employees Tracking"
            : mode === "admin"
              ? "Employment oversight"
              : "Employment Tracking"
        }
        description="Linked employment records, recorded milestones, and accountable updates. Separate from recruitment."
        action={
          mode === "employer" && (
            <Button
              variant="outline"
              disabled={!records.length}
              onClick={() =>
                downloadCsv(
                  "employee-tracking.csv",
                  [
                    "Employee ID",
                    "Name",
                    "Position",
                    "Department",
                    "Date Hired",
                    "Employment Type",
                    "Employment Status",
                    "Last Updated",
                  ],
                  records.map((r) => [
                    r.id,
                    state.users.find((u) => u.id === r.seekerId)?.name ?? "",
                    r.position,
                    r.department,
                    r.hiredAt,
                    r.classification,
                    r.status,
                    r.updatedAt,
                  ]),
                )
              }
            >
              <Download data-icon="inline-start" />
              Download CSV
            </Button>
          )
        }
      />
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Panel key={label} title={String(label)}>
            <p className="break-words text-lg font-semibold text-navy">
              {value}
            </p>
          </Panel>
        ))}
      </div>
      {mode === "jobseeker" && current && (
        <div className="mb-6">
          <EmploymentDetail key={current.id} record={current} />
        </div>
      )}
      <Panel
        title={
          mode === "jobseeker" ? "Employment history" : "Employment records"
        }
        description="Only records permitted for your current role are displayed."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search employee, position, or department…"
          />
          <SelectField
            label="Employment status"
            placeholder="All statuses"
            value={status}
            options={EMPLOYMENT_STATUSES}
            onChange={(e) => setStatus(e.target.value)}
          />
          <SelectField
            label="Employment type"
            placeholder="All types"
            value={classification}
            options={[...new Set([...JOB_TYPES, ...records.map((r) => r.classification)])]}
            onChange={(e) => setClassification(e.target.value)}
          />
        </div>
        {filtered.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Employee ID",
                  mode === "jobseeker" ? "Employer" : "Employee",
                  "Position",
                  "Department",
                  "Date hired",
                  "Start / end",
                  "Type",
                  "Status",
                  "Last updated",
                  "Actions",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-40 truncate" title={r.id}>
                    {r.id}
                  </TableCell>
                  <TableCell>
                    {mode === "jobseeker"
                      ? state.employers.find((e) => e.id === r.employerId)?.name
                      : state.users.find((u) => u.id === r.seekerId)?.name}
                  </TableCell>
                  <TableCell>{r.position}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{formatDate(r.hiredAt)}</TableCell>
                  <TableCell>
                    {r.startDate ? formatDate(r.startDate) : "Not started"} /{" "}
                    {r.endDate ? formatDate(r.endDate) : "—"}
                  </TableCell>
                  <TableCell>{r.classification}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>{formatDate(r.updatedAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(r.id);
                        setStaff("");
                      }}
                    >
                      View record
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No matching employment records"
            description={
              records.length
                ? "Try changing the search or filters."
                : "A verified employer confirming a hire creates a linked employment record here."
            }
          />
        )}
      </Panel>
      {mode === "admin" && user?.role === "admin" && (
        <div className="mt-6">
          <Panel
            title="Employment correction requests"
            description="Review requests without silently changing employer-verified information."
          >
            {state.correctionRequests
              .filter((c) => records.some((r) => r.id === c.employmentId))
              .map((c) => (
                <div
                  className="mb-4 flex flex-col items-start gap-3 rounded-lg border p-4"
                  key={c.id}
                >
                  <p className="text-xs font-medium">
                    {state.users.find((u) => u.id === c.seekerId)?.name} ·{" "}
                    {formatDate(c.createdAt)}
                  </p>
                  <StatusBadge status={c.status} />
                  <p className="break-words text-xs">{c.message}</p>
                  {c.resolution && <p className="text-xs">{c.resolution}</p>}
                  {c.status === "Pending" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReview(c.id);
                        setResolution("");
                      }}
                    >
                      Review request
                    </Button>
                  )}
                </div>
              ))}
            {!state.correctionRequests.length && (
              <EmptyState
                title="No correction requests"
                description="Job seeker requests will appear here."
              />
            )}
          </Panel>
        </div>
      )}
      <Dialog
        open={!!record}
        onOpenChange={(open) => {
          if (!open) setSelected("");
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee profile</DialogTitle>
            <DialogDescription>
              Employment details and preserved status history.
            </DialogDescription>
          </DialogHeader>
          {record && (
            <EmploymentDetail
              key={record.id}
              record={record}
              editable={mode === "employer"}
            />
          )}
          {record && user?.role === "admin" && (
            <FieldGroup>
              <SelectField
                label="Assign restricted staff oversight"
                placeholder="Choose active staff"
                value={staff}
                options={state.users
                  .filter((u) => u.role === "staff" && u.active)
                  .map((u) => ({ value: u.id, label: u.name }))}
                onChange={(e) => setStaff(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Assigned:{" "}
                {record.assignedStaffIds
                  .map((id) => state.users.find((u) => u.id === id)?.name)
                  .join(", ") || "None"}
              </p>
              <Button
                disabled={!staff || pending}
                onClick={() =>
                  run(
                    () => api.assignStaff(record.id, staff),
                    "Oversight assigned.",
                  )
                }
              >
                Assign oversight
              </Button>
            </FieldGroup>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open) setReview("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review correction request</DialogTitle>
            <DialogDescription>
              Record findings and employer follow-up. The job seeker will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.reviewCorrection(review, resolution);
                setReview("");
              }, "Review recorded.");
            }}
          >
            <FieldGroup>
              <TextField
                label="Review outcome and next steps"
                multiline
                required
                minLength={10}
                maxLength={2000}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
              <Button disabled={pending} type="submit">
                Record review
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
