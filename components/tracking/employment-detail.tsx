"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  Panel,
  TextField,
  SelectField,
  StatusBadge,
} from "@/components/shared";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import { EMPLOYMENT_STATUSES, ended } from "@/services/mock/tracking";
import type { EmployeeTrackingRecord, EmploymentStatus } from "@/types";
export function EmploymentDetail({
  record: r,
  editable = false,
}: {
  record: EmployeeTrackingRecord;
  editable?: boolean;
}) {
  const { state, user, api } = useDemo();
  const { run, pending } = useAction();
  const [form, setForm] = useState<"update" | "correction" | null>(null);
  const [status, setStatus] = useState<EmploymentStatus>(r.status);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [department, setDepartment] = useState(r.department);
  const [classification, setClassification] = useState(r.classification);
  const [confirmed, setConfirmed] = useState(false);
  const company = state.employers.find((e) => e.id === r.employerId);
  const person = state.users.find((u) => u.id === r.seekerId);
  const application = state.applications.find((a) => a.id === r.applicationId);
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title={r.position}
        description={`${company?.name} · ${person?.name}`}
        action={<StatusBadge status={r.status} />}
      >
        <dl className="grid gap-5 text-xs sm:grid-cols-2">
          {Object.entries({
            "Employee ID": r.id,
            Department: r.department,
            "Date hired": formatDate(r.hiredAt),
            "Employment start": r.startDate
              ? formatDate(r.startDate)
              : "Not recorded",
            "Employment classification": r.classification,
            "Employment end": r.endDate ? formatDate(r.endDate) : "—",
            "Last status update": formatDate(r.updatedAt),
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {editable && !ended(r.status) && (
            <Button
              onClick={() => {
                setForm("update");
                setReason("");
                setConfirmed(false);
                setStatus(r.status);
              }}
            >
              Update employment status
            </Button>
          )}
          {user?.role === "jobseeker" && (
            <Button
              variant="outline"
              onClick={() => {
                setForm("correction");
                setReason("");
              }}
            >
              Report Incorrect Information
            </Button>
          )}
        </div>
      </Panel>
      <Panel
        title="Employment timeline"
        description="Only milestones supported by recorded events are shown."
      >
        <ol className="flex flex-col gap-6">
          {application?.timeline
            .filter((e) => e.status === "Hired")
            .slice(0, 1)
            .map((e) => (
              <li className="flex gap-3" key={e.date}>
                <CheckCircle2 className="size-5 shrink-0 text-teal" />
                <p className="text-xs">
                  Application accepted · officially hired · {formatDate(e.date)}
                </p>
              </li>
            ))}
          {r.history.map((h) => (
            <li className="flex gap-3" key={h.id}>
              <CheckCircle2 className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 text-xs">
                <p className="font-medium">
                  {r.startDate &&
                  h.id ===
                    r.history.find(
                      (event) =>
                        event.status !== "Hired — Pending Start" &&
                        !ended(event.status),
                    )?.id
                    ? "Employment started · "
                    : ""}
                  {h.status} · {formatDate(h.effectiveDate)}
                </p>
                <p className="mt-1 break-words text-muted-foreground">
                  {h.remarks}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Recorded {new Date(h.recordedAt).toLocaleString("en-PH")} by{" "}
                  {state.users.find((u) => u.id === h.actorId)?.name ??
                    "Employer"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      {state.correctionRequests
        .filter((c) => c.employmentId === r.id)
        .map((c) => (
          <Panel
            key={c.id}
            title="Correction request"
            description={formatDate(c.createdAt)}
          >
            <StatusBadge status={c.status} />
            <p className="mt-3 break-words text-xs">{c.message}</p>
            {c.resolution && (
              <p className="mt-2 text-xs text-muted-foreground">
                {c.resolution}
              </p>
            )}
          </Panel>
        ))}
      <Dialog
        open={!!form}
        onOpenChange={(o) => {
          if (!o) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form === "update"
                ? "Update employment status"
                : "Request an employment correction"}
            </DialogTitle>
            <DialogDescription>
              {form === "update"
                ? "Updates the linked employment record, notification history, and PESO audit log."
                : "PESO will review your request. Employer-verified status cannot be directly edited."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (form === "update")
                  await api.updateEmployment(r.id, {
                    status,
                    effectiveDate: date,
                    remarks: reason,
                    department,
                    classification,
                    confirmed,
                  });
                else await api.requestCorrection(r.id, reason);
                setForm(null);
              }, "Employment action recorded.");
            }}
          >
            <FieldGroup>
              {form === "update" && (
                <>
                  <SelectField
                    label="New status"
                    value={status}
                    options={EMPLOYMENT_STATUSES}
                    onChange={(e) =>
                      setStatus(e.target.value as EmploymentStatus)
                    }
                  />
                  <TextField
                    label="Effective date"
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <TextField
                    label="Department"
                    required
                    maxLength={100}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                  <TextField
                    label="Employment classification"
                    help="Separate from employment status, for example Full-time or Part-time."
                    required
                    maxLength={100}
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                  />
                </>
              )}
              <TextField
                label={
                  form === "update"
                    ? "Reason or remarks"
                    : "Describe the incorrect information"
                }
                required
                multiline
                minLength={10}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {form === "update" && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="confirm-employment"
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(v === true)}
                  />
                  <FieldLabel htmlFor="confirm-employment">
                    I confirm these employment details are accurate.
                  </FieldLabel>
                </Field>
              )}
              <Button
                type="submit"
                disabled={pending || (form === "update" && !confirmed)}
              >
                {pending
                  ? "Saving…"
                  : form === "update"
                    ? "Confirm status update"
                    : "Submit correction request"}
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
