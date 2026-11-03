"use client";

import { useState } from "react";
import { CheckCircle2, Flag, Trash2 } from "lucide-react";
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
  EmptyState,
  Notice,
} from "@/components/shared";
import {
  SearchInput,
  ListPagination,
  PAGE_SIZE,
} from "@/components/dashboard/list-controls";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { salaryLabel, formatDate } from "@/lib/format";
import type { JobPosting } from "@/types";

export function VacancyOversight() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const records = state.jobs.filter(
    (j) =>
      (!filter || j.status === filter) &&
      `${j.title} ${state.employers.find((e) => e.id === j.employerId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(records.length / PAGE_SIZE)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Keep local opportunities trustworthy"
        title="Clear standards. Better opportunities."
        description="Inspect job postings, confirm employer approval, and record moderation decisions."
      />
      <Panel
        title="Vacancy oversight"
        description="Moderation changes are recorded in the  audit log."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search vacancy or employer…"
          />
          <div className="sm:w-48">
            <SelectField
              label="Vacancy status"
              placeholder="All posting states"
              options={["Published", "Draft", "Closed", "Flagged", "Removed"]}
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
                <TableHead>Vacancy</TableHead>
                <TableHead>Employer approval</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((job) => {
                  const company = state.employers.find(
                    (e) => e.id === job.employerId,
                  );
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <p className="font-medium text-navy">{job.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {company?.name} · {job.barangay}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={
                            company?.accreditationStatus ?? "Pending Review"
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(job.deadline)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          onClick={() => setSelected(job.id)}
                          aria-label={`Review vacancy ${job.title}`}
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
            title="No vacancies in this view."
            description="Clear your filters to see more postings."
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
            <VacancyReview
              key={selected}
              id={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function VacancyReview({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const job = state.jobs.find((j) => j.id === id)!;
  const company = state.employers.find((e) => e.id === job.employerId)!;
  const decide = (status: JobPosting["status"]) => {
    if (["Flagged", "Removed"].includes(status) && reason.trim().length < 10) {
      setError("Provide a moderation reason of at least 10 characters.");
      return;
    }
    setError("");
    void run(async () => {
      await api.moderateJob(id, status, reason.trim());
      onClose();
    }, `vacancy ${status.toLowerCase()}.`);
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{job.title}</DialogTitle>
        <DialogDescription>
          {company.name} · {job.barangay} · {job.type}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={job.status} />
        <StatusBadge status={company.accreditationStatus} />
      </div>
      <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-muted p-4 text-xs">
        <div>
          <dt className="text-muted-foreground">Monthly salary</dt>
          <dd className="mt-2 font-medium">{salaryLabel(job)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Deadline</dt>
          <dd className="mt-2 font-medium">{formatDate(job.deadline)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Openings</dt>
          <dd className="mt-2">{job.openings}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Category</dt>
          <dd className="mt-2">{job.category}</dd>
        </div>
      </dl>
      <p className="whitespace-pre-wrap text-xs leading-7 text-muted-foreground">
        {job.description}
      </p>
      <h3 className="text-xs font-semibold">Qualifications</h3>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-xs text-muted-foreground">
        {job.qualifications.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      {job.moderationNote && (
        <Notice title="Previous moderation feedback" warning>
          {job.moderationNote}
        </Notice>
      )}
      <FieldGroup>
        <TextField
          label="Moderation note / reason"
          multiline
          rows={3}
          value={reason}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
          help="Required when flagging or removing a posting. Shared with the employer."
          error={error}
        />
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || company.accreditationStatus !== "Approved"}
          onClick={() => decide("Published")}
        >
          <CheckCircle2 data-icon="inline-start" />
          Approve / restore
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => decide("Flagged")}
        >
          <Flag data-icon="inline-start" />
          Flag posting
        </Button>
        <Button
          variant="destructive"
          disabled={pending || job.status === "Removed"}
          onClick={() => decide("Removed")}
        >
          <Trash2 data-icon="inline-start" />
          Remove posting
        </Button>
      </div>
      <p className="text-[10px] leading-5 text-muted-foreground">
        Approval requires an approved employer and an unexpired deadline.
        Removed records remain in the audit and recruitment history.
      </p>
    </>
  );
}
