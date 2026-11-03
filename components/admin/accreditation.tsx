"use client";

import { useState } from "react";
import { CheckCircle2, CircleX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
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
  SelectField,
  TextField,
  StatusBadge,
  CompanyMark,
  EmptyState,
  Notice,
} from "@/components/shared";
import {
  SearchInput,
  ListPagination,
  PAGE_SIZE,
} from "@/components/dashboard/list-controls";
import { DocumentPreview } from "@/components/dashboard/document-preview";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import type { AccreditationStatus } from "@/types";

export function AdminAccreditations() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const records = state.accreditations
    .filter(
      (a) =>
        (!filter || a.status === filter) &&
        state.employers
          .find((e) => e.id === a.employerId)
          ?.name.toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.status === "Pending Review") -
          Number(a.status === "Pending Review") ||
        b.submittedAt.localeCompare(a.submittedAt),
    );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(records.length / PAGE_SIZE)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Build trust in every opportunity"
        title="A thoughtful review, a stronger community."
        description="Review employer accreditation, provide actionable feedback, and maintain a clear decision history."
      />
      <Panel
        title="Employer accreditation"
        description="Pending submissions are shown first. All documents are provided metadata records."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search local employers…"
          />
          <div className="sm:w-56">
            <SelectField
              label="Accreditation status"
              placeholder="All review states"
              options={[
                "Pending Review",
                "Approved",
                "Rejected",
                "Resubmission Requested",
              ]}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((a) => {
                  const company = state.employers.find(
                    (e) => e.id === a.employerId,
                  )!;
                  const complete = state.preferences.requirements.filter((r) =>
                    a.documents.some((d) => d.category === r),
                  ).length;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CompanyMark
                            initials={company.initials}
                            color={company.color}
                          />
                          <div>
                            <p className="font-medium text-navy">
                              {company.name}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {company.barangay} · {company.industry}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(a.submittedAt)}
                      </TableCell>
                      <TableCell>
                        {complete}/{state.preferences.requirements.length}{" "}
                        requirements
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          onClick={() => setSelected(company.id)}
                          aria-label={`Review ${company.name}`}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Your review queue is clear."
            description="No employers match these filters."
          />
        )}
        <ListPagination
          total={records.length}
          page={currentPage}
          onChange={setPage}
        />
      </Panel>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {selected && (
            <AccreditationReview
              key={selected}
              employerId={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccreditationReview({
  employerId,
  onClose,
}: {
  employerId: string;
  onClose: () => void;
}) {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const company = state.employers.find((e) => e.id === employerId)!;
  const accreditation = state.accreditations.find(
    (a) => a.employerId === employerId,
  )!;
  const missing = state.preferences.requirements.filter(
    (r) => !accreditation.documents.some((d) => d.category === r),
  );
  const decide = async (status: AccreditationStatus) => {
    if (status !== "Approved" && reason.trim().length < 10) {
      setError(
        "Give a clear reason of at least 10 characters so the employer knows what to do next.",
      );
      return;
    }
    setError("");
    await run(async () => {
      await api.reviewAccreditation(employerId, status, reason);
      onClose();
    }, `accreditation updated to ${status}.`);
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{company.name}</DialogTitle>
        <DialogDescription>
          {company.industry} · {company.barangay} · Authorized representative:{" "}
          {company.representative}
        </DialogDescription>
      </DialogHeader>
      <StatusBadge status={accreditation.status} />
      <div className="rounded-xl bg-muted p-4 text-xs leading-6 text-muted-foreground">
        <p>{company.address}</p>
        <p>
          {company.email} · {company.phone}
        </p>
      </div>
      <h3 className="text-sm font-semibold">Configured requirements</h3>
      <div className="flex flex-col gap-3">
        {state.preferences.requirements.map((category) => {
          const document = accreditation.documents.find(
            (d) => d.category === category,
          );
          return (
            <div
              key={category}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="text-xs font-medium text-navy">{category}</p>
                <p className="mt-1 max-w-xs truncate text-[10px] text-muted-foreground">
                  {document?.name ?? "Missing from this submission"}
                </p>
              </div>
              {document ? (
                <DocumentPreview file={document} />
              ) : (
                <StatusBadge status="Resubmission Requested" />
              )}
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <Notice title="Missing requirements" warning>
          Approval is unavailable until every configured requirement has sample
          metadata.
        </Notice>
      )}
      <FieldGroup>
        <TextField
          label="Review feedback / reason"
          multiline
          rows={3}
          value={reason}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
          help="A reason is required for rejection or resubmission. Approval feedback is optional."
          error={error}
        />
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            pending || !!missing.length || accreditation.status === "Approved"
          }
          onClick={() => decide("Approved")}
        >
          <CheckCircle2 data-icon="inline-start" />
          Approve sample
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => decide("Resubmission Requested")}
        >
          <RotateCcw data-icon="inline-start" />
          Request resubmission
        </Button>
        <Button
          variant="destructive"
          disabled={pending || accreditation.status === "Rejected"}
          onClick={() => decide("Rejected")}
        >
          <CircleX data-icon="inline-start" />
          Reject
        </Button>
      </div>
      <p className="text-[10px] leading-5 text-muted-foreground">
         decisions update employer access in this browser. No real
        accreditation, external verification, or government action occurs.
      </p>
      <h3 className="mt-2 text-sm font-semibold">Review history</h3>
      <ol className="flex flex-col gap-3">
        {[...accreditation.history].reverse().map((item, i) => (
          <li key={`${item.date}-${i}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={item.status} />
              <time className="text-[10px] text-muted-foreground">
                {formatDate(item.date)}
              </time>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {item.reason}
            </p>
            <p className="text-[10px] text-muted-foreground">{item.reviewer}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
