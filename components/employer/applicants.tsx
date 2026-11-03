"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Mail,
  MapPin,
  Phone,
  Send,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { DocumentPreview } from "@/components/dashboard/document-preview";
import { ApplicationTimeline } from "@/components/dashboard/application-timeline";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { APPLICATION_STATUSES } from "@/constants";
import { formatDate, initials } from "@/lib/format";
import type { ApplicationStatus, JobApplication } from "@/types";

export function EmployerApplicants({
  initialJob = "",
}: {
  initialJob?: string;
}) {
  const { state, employer } = useDemo();
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState(initialJob);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  if (!employer) return null;
  const jobs = state.jobs.filter((j) => j.employerId === employer.id);
  const applications = state.applications
    .filter(
      (a) =>
        jobs.some((j) => j.id === a.jobId) &&
        (!jobId || a.jobId === jobId) &&
        (!status || a.status === status),
    )
    .filter((a) =>
      `${state.seekers.find((s) => s.id === a.seekerId)?.name} ${jobs.find((j) => j.id === a.jobId)?.title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(applications.length / PAGE_SIZE)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Meet your next teammate"
        title="People with potential, close to home."
        description="Review candidates who applied to your company’s vacancies. Private profiles from unrelated employers are not shown."
      />
      <Panel
        title="Your applicants"
        description={`${applications.length} applications in this view`}
      >
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search candidate or vacancy…"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[460px]">
            <SelectField
              label="Your vacancy"
              value={jobId}
              placeholder="All your vacancies"
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
              onChange={(e) => {
                setJobId(e.target.value);
                setPage(1);
              }}
            />
            <SelectField
              label="Recruitment status"
              value={status}
              placeholder="All statuses"
              options={APPLICATION_STATUSES}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {applications.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Applied for</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((application) => {
                  const seeker = state.seekers.find(
                    (s) => s.id === application.seekerId,
                  );
                  return (
                    <TableRow key={application.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {initials(seeker?.name ?? "Sample")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-navy">
                              {seeker?.name}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {seeker?.barangay}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {jobs.find((j) => j.id === application.jobId)?.title}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(application.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={application.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/employer/applicants/${application.id}`}
                          className="text-link whitespace-nowrap text-xs"
                        >
                          Review candidate
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No candidates in this view yet."
            description="Try another vacancy or clear the filters. Candidates appear after a job seeker submits a application to your company."
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

export function CandidateDetail({ id }: { id: string }) {
  const { state, employer } = useDemo();
  const application = state.applications.find(
    (a) =>
      a.id === id &&
      state.jobs.some((j) => j.id === a.jobId && j.employerId === employer?.id),
  );
  const seeker = state.seekers.find((s) => s.id === application?.seekerId);
  const job = state.jobs.find((j) => j.id === application?.jobId);
  if (!application || !seeker || !job)
    return (
      <EmptyState
        title="This candidate isn’t available to your company."
        description="Only applications submitted to your own vacancies can be reviewed in this ."
        href="/employer/applicants"
        label="Back to your applicants"
      />
    );
  return (
    <>
      <Link href="/employer/applicants" className="text-link mb-5 text-xs">
        <ArrowLeft className="size-3.5" />
        Back to your applicants
      </Link>
      <PageHeading
        title={seeker.name}
        description={`Applied for ${job.title} · ${formatDate(application.submittedAt)}`}
        action={<StatusBadge status={application.status} />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Candidate profile"
            description="Shared for this application only. Use the information only for the intended recruitment purpose."
          >
            <p className="text-sm font-medium text-navy">{seeker.headline}</p>
            <div className="mt-5 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
              <p className="flex items-center gap-2 break-all">
                <Mail className="size-4 shrink-0" />
                {seeker.email}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4" />
                {seeker.phone}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4" />
                {seeker.barangay}, Santa Maria
              </p>
            </div>
            <h3 className="mt-6 text-xs font-semibold">Education & training</h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {seeker.education}
            </p>
            <h3 className="mt-5 text-xs font-semibold">Experience</h3>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
              {seeker.experience || "Seeking a first work opportunity."}
            </p>
            <h3 className="mt-5 text-xs font-semibold">Skills</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {seeker.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
            <div className="mt-6">
              <DocumentPreview
                file={{ name: application.resumeName }}
                label="View resume metadata"
              />
            </div>
            <h3 className="mt-6 text-xs font-semibold">
              Submitted cover letter
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
              {application.coverLetter || "No cover letter was included."}
            </p>
          </Panel>
          <Panel title="Application history">
            <ApplicationTimeline application={application} />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <RecruitmentStatusForm
            key={`${id}-${application.status}`}
            application={application}
          />
          <CandidateNotes key={id} application={application} />
          <Notice title="Respect candidate privacy">
            These details must not be shared with unrelated employers.
            The future backend must enforce ownership, purpose-limited access,
            and retention policies.
          </Notice>
        </div>
      </div>
    </>
  );
}

function RecruitmentStatusForm({
  application,
}: {
  application: JobApplication;
}) {
  const { api } = useDemo();
  const { run, pending } = useAction();
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [location, setLocation] = useState(
    application.interview?.location ?? "",
  );
  const [error, setError] = useState("");
  const defaultInterviewDate = application.interview
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(application.interview.date)).replace(" ", "T")
    : "";
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("interviewDate") ?? "");
    const interview =
      status === "Interview Scheduled"
        ? { date: date ? `${date}+08:00` : "", location: location.trim() }
        : undefined;
    if (
      interview &&
      (!Number.isFinite(Date.parse(interview.date)) ||
        Date.parse(interview.date) <= Date.now() ||
        interview.location.length < 3)
    ) {
      setError(
        "Choose a future interview date and add a location or meeting link.",
      );
      return;
    }
    if (status === application.status && !interview) {
      setError("Choose a different recruitment status.");
      return;
    }
    setError("");
    await run(
      () => api.updateApplication(application.id, status, interview),
      "application updated. The job seeker can see the change in their portal.",
    );
  };
  return (
    <Panel
      title="Keep the candidate updated"
      description="Status changes update the connected job seeker’s timeline."
    >
      <form onSubmit={submit}>
        <FieldGroup>
          <SelectField
            label="Recruitment status"
            options={APPLICATION_STATUSES}
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
          />
          {status === "Interview Scheduled" && (
            <>
              <TextField
                label="Interview date & time (Philippine time)"
                type="datetime-local"
                name="interviewDate"
                required
                step={60}
                defaultValue={defaultInterviewDate}
              />
              <TextField
                label="Location or meeting link"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={250}
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                This records a appointment only. No email, calendar
                invite, or SMS is sent.
              </p>
            </>
          )}
          {status === "Rejected" && (
            <p className="rounded-lg bg-danger-soft p-3 text-xs leading-6 text-destructive">
              This records a final rejection outcome. It is not a required stage
              in the recruitment process.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <Send data-icon="inline-start" />
            {pending ? "Updating…" : "Update application"}
          </Button>
        </FieldGroup>
      </form>
    </Panel>
  );
}

function CandidateNotes({ application }: { application: JobApplication }) {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const [note, setNote] = useState("");
  return (
    <Panel
      title="Internal recruitment notes"
      description="Not visible to the job seeker. Session-only, for your company."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await api.addNote(application.id, note);
            setNote("");
          }, "Internal note added.");
        }}
      >
        <FieldGroup>
          <TextField
            label="Add an internal note"
            multiline
            rows={3}
            required
            minLength={1}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            variant="outline"
            type="submit"
            disabled={pending || !note.trim()}
          >
            <MessageSquare data-icon="inline-start" />
            Add note
          </Button>
        </FieldGroup>
      </form>
      <ul className="mt-5 flex flex-col gap-4">
        {application.notes.map((item) => (
          <li key={item.id} className="rounded-xl border bg-muted p-4">
            <p className="whitespace-pre-wrap break-words text-xs leading-6">
              {item.text}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {state.users.find((u) => u.id === item.authorId)?.name ??
                "Company reviewer"}{" "}
              · {formatDate(item.date)}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
