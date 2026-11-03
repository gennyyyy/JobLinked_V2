"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  MapPin,
} from "lucide-react";
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
  StatusBadge,
  EmptyState,
  SelectField,
  CompanyMark,
} from "@/components/shared";
import {
  SearchInput,
  ListPagination,
  PAGE_SIZE,
} from "@/components/dashboard/list-controls";
import { ApplicationTimeline } from "@/components/dashboard/application-timeline";
import { DocumentPreview } from "@/components/dashboard/document-preview";
import { useDemo } from "@/hooks/use-demo";
import { APPLICATION_STATUSES } from "@/constants";
import { formatDate } from "@/lib/format";

export function JobSeekerApplications() {
  const { state, user } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  if (!user) return null;
  const applications = state.applications
    .filter((a) => a.seekerId === user.id)
    .filter((a) => {
      const job = state.jobs.find((j) => j.id === a.jobId);
      return (
        (!status || a.status === status) &&
        `${job?.title} ${state.employers.find((e) => e.id === job?.employerId)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(applications.length / PAGE_SIZE)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Every step counts"
        title="See how your story is moving."
        description="Track your applications, from your first hello to the employer’s decision."
        action={
          <LinkButton href="/jobs">
            <BriefcaseBusiness data-icon="inline-start" />
            Find more opportunities
          </LinkButton>
        }
      />
      <Panel
        title="My applications"
        description="Only applications submitted by your current account are shown."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search by job or employer…"
          />
          <div className="sm:w-52">
            <SelectField
              label="Application status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              placeholder="All statuses"
              options={APPLICATION_STATUSES}
            />
          </div>
        </div>
        {applications.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((a) => {
                  const job = state.jobs.find((j) => j.id === a.jobId);
                  const company = state.employers.find(
                    (e) => e.id === job?.employerId,
                  );
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CompanyMark
                            initials={company?.initials ?? "J"}
                            color={company?.color}
                          />
                          <div>
                            <Link
                              href={`/jobseeker/applications/${a.id}`}
                              className="font-medium text-navy hover:text-primary"
                            >
                              {job?.title ?? "Unavailable vacancy"}
                            </Link>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {company?.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(a.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/jobseeker/applications/${a.id}`}
                          className="text-link whitespace-nowrap text-xs"
                        >
                          Track
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="A fresh start is a good start."
            description="No applications match this view. Explore an opportunity and submit a application to see it here."
            href="/jobs"
          />
        )}
        <ListPagination
          total={applications.length}
          page={currentPage}
          onChange={setPage}
        />
      </Panel>
    </>
  );
}

export function JobSeekerApplicationDetail({ id }: { id: string }) {
  const { state, user } = useDemo();
  const application = state.applications.find(
    (a) => a.id === id && a.seekerId === user?.id,
  );
  const job = state.jobs.find((j) => j.id === application?.jobId);
  const company = state.employers.find((e) => e.id === job?.employerId);
  if (!application || !job || !company)
    return (
      <EmptyState
        title="This application isn’t available."
        description="You can only view applications from your current account."
        href="/jobseeker/applications"
        label="Back to my applications"
      />
    );
  return (
    <>
      <Link className="text-link mb-5 text-xs" href="/jobseeker/applications">
        <ArrowLeft className="size-3.5" />
        Back to my applications
      </Link>
      <PageHeading
        title={job.title}
        description={`${company.name} · Submitted ${formatDate(application.submittedAt)}`}
        action={<StatusBadge status={application.status} />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel
          title="Your application journey"
          description="Updates from the employer appear here and in your notifications."
        >
          <ApplicationTimeline application={application} />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="The opportunity">
            <div className="flex items-center gap-3">
              <CompanyMark initials={company.initials} color={company.color} />
              <div>
                <p className="text-sm font-semibold text-navy">
                  {company.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {company.industry}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <MapPin className="size-4" />
                {job.barangay}, Santa Maria
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                Deadline: {formatDate(job.deadline)}
              </p>
              <p>Recruitment record: {application.id.slice(0, 24)}</p>
            </div>
            {job.status === "Published" && (
              <LinkButton
                href={`/jobs/${job.id}`}
                variant="outline"
                className="mt-5"
              >
                View vacancy
                <ArrowUpRight data-icon="inline-end" />
              </LinkButton>
            )}
          </Panel>
          <Panel
            title="What you submitted"
            description="Your submission is a snapshot; later resume changes do not replace it."
          >
            <p className="mb-3 break-all text-xs font-medium text-navy">
              {application.resumeName}
            </p>
            <DocumentPreview
              file={{ name: application.resumeName }}
              label="Resume metadata"
            />
            <h3 className="mt-6 text-xs font-semibold">Cover letter</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
              {application.coverLetter || "No cover letter was included."}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
