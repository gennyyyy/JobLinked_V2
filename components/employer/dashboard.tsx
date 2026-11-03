"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  Users,
  UserCheck,
  Handshake,
  Plus,
  ArrowRight,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import {
  PageHeading,
  Panel,
  StatCards,
  LinkButton,
  StatusBadge,
  Notice,
  EmptyState,
} from "@/components/shared";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useDemo } from "@/hooks/use-demo";
import { isJobOpen, formatDate } from "@/lib/format";

export function EmployerRestriction() {
  const { employer } = useDemo();
  if (!employer || employer.accreditationStatus === "Approved") return null;
  return (
    <div className="mb-6">
      <Notice title={`Accreditation: ${employer.accreditationStatus}`} warning>
        You can prepare drafts, but publishing is unavailable until PESO
        approves your accreditation.{" "}
        <Link
          href="/employer/accreditation"
          className="font-medium underline underline-offset-4"
        >
          Review requirements and feedback.
        </Link>
      </Notice>
    </div>
  );
}

export function EmployerDashboard() {
  const { state, employer, user } = useDemo();
  if (!employer || !user) return null;
  const jobs = state.jobs.filter((j) => j.employerId === employer.id);
  const applications = state.applications.filter((a) =>
    jobs.some((j) => j.id === a.jobId),
  );
  return (
    <>
      <PageHeading
        eyebrow="Build something together"
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        description={`Good people make great teams. Here’s what’s happening at ${employer.name}.`}
        action={
          <LinkButton href="/employer/jobs/new">
            <Plus data-icon="inline-start" />
            Create a vacancy
          </LinkButton>
        }
      />
      <EmployerRestriction />
      <StatCards
        stats={[
          {
            label: "Active vacancies",
            value: jobs.filter(isJobOpen).length,
            icon: BriefcaseBusiness,
          },
          {
            label: "Total applicants",
            value: applications.length,
            icon: Users,
          },
          {
            label: "Shortlisted candidates",
            value: applications.filter((a) => a.status === "Shortlisted")
              .length,
            icon: UserCheck,
            tone: "teal",
          },
          {
            label: "placements",
            value: applications.filter((a) => a.status === "Hired").length,
            icon: Handshake,
            tone: "teal",
          },
        ]}
      />
      <div className="portal-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Your latest applicants"
            description="Meet the people interested in joining your team."
            action={
              <Link
                href="/employer/applicants"
                className="text-link text-[11px]"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            }
          >
            {applications.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>
                      <span className="sr-only">Review</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...applications]
                    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
                    .slice(0, 5)
                    .map((a) => {
                      const seeker = state.seekers.find(
                        (s) => s.id === a.seekerId,
                      );
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Link
                              className="text-xs font-semibold text-navy hover:text-primary"
                              href={`/employer/applicants/${a.id}`}
                            >
                              {seeker?.name}
                            </Link>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {jobs.find((j) => j.id === a.jobId)?.title}
                            </p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={a.status} />
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/employer/applicants/${a.id}`}
                              className="text-link text-xs"
                            >
                              Review
                              <ArrowRight className="size-3" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="Your next teammate is out there."
                description="Publish an approved vacancy to start receiving applications."
                href="/employer/jobs/new"
                label="Create a vacancy"
              />
            )}
          </Panel>
          <Panel
            title="Your vacancies"
            description="A quick look at the opportunities you are creating."
            action={
              <Link className="text-link text-[11px]" href="/employer/jobs">
                Manage jobs
                <ArrowRight className="size-3" />
              </Link>
            }
          >
            {jobs.length ? (
              <ul className="flex flex-col divide-y">
                {jobs.slice(0, 4).map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <Link
                        className="text-xs font-semibold text-navy hover:text-primary"
                        href={`/employer/jobs/${job.id}/edit`}
                      >
                        {job.title}
                      </Link>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {job.barangay} · {job.openings} openings ·{" "}
                        {applications.filter((a) => a.jobId === job.id).length}{" "}
                        applicants
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No vacancies yet. Start with a draft.
              </p>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Your accreditation"
            action={<ShieldCheck className="size-5 text-teal" />}
          >
            <StatusBadge status={employer.accreditationStatus} />
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              {employer.accreditationStatus === "Approved"
                ? "Your business is approved to publish vacancies in this nstration. This is not actual municipal accreditation."
                : "A PESO  administrator can review your submitted metadata and update the decision."}
            </p>
            <Link
              href="/employer/accreditation"
              className="text-link mt-3 text-xs"
            >
              View accreditation
              <ArrowRight className="size-3" />
            </Link>
          </Panel>
          <div className="rounded-2xl border border-teal/10 bg-teal-soft p-6">
            <ClipboardCheck className="mb-4 size-6 text-teal" />
            <h2 className="text-base font-semibold">
              Thoughtful hiring starts here.
            </h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Keep qualifications clear, set a realistic deadline, and update
              candidates as you go. A little communication makes a big
              difference.
            </p>
            <Link className="text-link mt-3 text-xs" href="/employer/jobs/new">
              Write a great job post
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <Panel
            title="Recent recruitment activity"
            description="Updates from your own vacancies only."
          >
            <ul className="flex flex-col gap-4">
              {applications.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <p className="text-xs leading-6 text-navy">
                    {state.seekers.find((s) => s.id === a.seekerId)?.name} ·{" "}
                    {a.status}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(a.timeline.at(-1)?.date ?? a.submittedAt)}
                  </p>
                </li>
              ))}
              {!applications.length && (
                <li className="text-xs text-muted-foreground">
                  Activity will appear here as candidates apply.
                </li>
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
