"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Users, ArrowUpRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  LinkButton,
  SelectField,
  StatusBadge,
  EmptyState,
  ConfirmButton,
} from "@/components/shared";
import {
  SearchInput,
  ListPagination,
  PAGE_SIZE,
} from "@/components/dashboard/list-controls";
import { EmployerRestriction } from "./dashboard";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";

export function EmployerJobs() {
  const { state, employer, api } = useDemo();
  const { run, pending } = useAction();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  if (!employer) return null;
  const jobs = state.jobs.filter(
    (j) =>
      j.employerId === employer.id &&
      (!status || j.status === status) &&
      j.title.toLowerCase().includes(query.toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(jobs.length / PAGE_SIZE)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Create local opportunities"
        title="Good work starts with a great team."
        description="Manage your vacancies, prepare drafts, and keep your recruitment up to date."
        action={
          <LinkButton href="/employer/jobs/new">
            <Plus data-icon="inline-start" />
            Create a vacancy
          </LinkButton>
        }
      />
      <EmployerRestriction />
      <Panel
        title="Your job postings"
        description="Only vacancies owned by your current company are shown."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search your job postings…"
          />
          <div className="sm:w-48">
            <SelectField
              label="Posting status"
              placeholder="All statuses"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={["Draft", "Published", "Closed", "Flagged", "Removed"]}
            />
          </div>
        </div>
        {jobs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vacancy</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <p className="font-medium text-navy">{job.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {job.barangay} · {job.type} · {job.openings} openings
                      </p>
                      {job.moderationNote && (
                        <p className="mt-2 max-w-xs text-[11px] leading-5 text-destructive">
                          PESO feedback: {job.moderationNote}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/employer/applicants?job=${job.id}`}
                        className="text-link text-xs"
                      >
                        <Users className="size-3.5" />
                        {
                          state.applications.filter((a) => a.jobId === job.id)
                            .length
                        }{" "}
                        applicants
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(job.deadline)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {!["Flagged", "Removed"].includes(job.status) ? (
                          <>
                            <LinkButton
                              href={`/employer/jobs/${job.id}/edit`}
                              variant="outline"
                              aria-label={`Edit ${job.title}`}
                            >
                              <Pencil data-icon="inline-start" />
                              Edit
                            </LinkButton>
                            {job.status === "Published" ? (
                              <ConfirmButton
                                variant="ghost"
                                title="Close this vacancy?"
                                description="This stops new applications. Existing applications and candidate history remain available."
                                onConfirm={() =>
                                  run(
                                    () =>
                                      api.updateJob(job.id, {
                                        status: "Closed",
                                      }),
                                    "vacancy closed.",
                                  )
                                }
                              >
                                Close
                              </ConfirmButton>
                            ) : (
                              <Button
                                variant="ghost"
                                disabled={
                                  pending ||
                                  employer.accreditationStatus !== "Approved"
                                }
                                onClick={() =>
                                  run(
                                    () =>
                                      api.updateJob(job.id, {
                                        status: "Published",
                                      }),
                                    "vacancy published.",
                                  )
                                }
                              >
                                {job.status === "Closed" ? "Reopen" : "Publish"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <LockKeyhole className="size-3" />
                            PESO clearance required
                          </span>
                        )}
                        {job.status === "Published" && (
                          <LinkButton
                            href={`/jobs/${job.id}`}
                            variant="ghost"
                            aria-label={`View ${job.title}`}
                          >
                            <ArrowUpRight />
                          </LinkButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Your next opening starts here."
            description="No vacancies match this view. Clear the filters or create a new job posting."
            href="/employer/jobs/new"
            label="Create a vacancy"
          />
        )}
        <ListPagination
          total={jobs.length}
          page={currentPage}
          onChange={setPage}
        />
      </Panel>
    </>
  );
}
