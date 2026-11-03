"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Bookmark,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  UserRound,
  Bell,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  PageHeading,
  Panel,
  StatCards,
  LinkButton,
  StatusBadge,
  EmptyState,
  CompanyMark,
} from "@/components/shared";
import { JobCard } from "@/components/jobs/job-card";
import { useDemo } from "@/hooks/use-demo";
import {
  formatDate,
  isJobOpen,
  matchJob,
  profileCompletion,
} from "@/lib/format";

export function JobSeekerDashboard() {
  const { state, user, seeker } = useDemo();
  if (!seeker || !user) return null;
  const applications = state.applications.filter((a) => a.seekerId === user.id);
  const completion = profileCompletion(seeker);
  const recommended = state.jobs
    .filter(
      (j) =>
        isJobOpen(j) &&
        state.employers.find((e) => e.id === j.employerId)
          ?.accreditationStatus === "Approved",
    )
    .sort((a, b) => matchJob(b, seeker).score - matchJob(a, seeker).score)
    .slice(0, 2);
  const interview = applications
    .filter(
      (a) =>
        a.status === "Interview Scheduled" &&
        a.interview &&
        new Date(a.interview.date) >= new Date(),
    )
    .sort((a, b) => a.interview!.date.localeCompare(b.interview!.date))[0];
  const notifications = state.notifications
    .filter((n) => n.userId === user.id && !n.read)
    .slice(0, 2);
  return (
    <>
      <PageHeading
        eyebrow="Your next chapter"
        title={`Good to see you, ${user.name.split(" ")[0]}.`}
        description="A little progress today can open a new door tomorrow. Let’s find your next local opportunity."
        action={
          <LinkButton href="/jobs">
            <BriefcaseBusiness data-icon="inline-start" />
            Explore jobs
          </LinkButton>
        }
      />
      <StatCards
        stats={[
          {
            label: "Applications sent",
            value: applications.length,
            icon: ClipboardList,
          },
          {
            label: "Saved opportunities",
            value: seeker.savedJobIds.length,
            icon: Bookmark,
          },
          {
            label: "Upcoming interviews",
            value: applications.filter(
              (a) => a.status === "Interview Scheduled",
            ).length,
            icon: CalendarDays,
            tone: "teal",
          },
          {
            label: "Profile complete",
            value: `${completion}%`,
            icon: UserRound,
            note: "Your profile, at a glance",
            tone: "teal",
          },
        ]}
      />
      <div className="mb-6 flex flex-col justify-between gap-5 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-[10px] font-medium tracking-[.14em] text-white/65 uppercase">
            Opportunities close to home
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Your skills belong somewhere great.
          </h2>
          <p className="mt-2 max-w-lg text-xs leading-6 text-white/70">
            Explore verified employers across Santa Maria’s 24 barangays.
            Your next connection could be just around the corner.
          </p>
        </div>
        <LinkButton href="/jobseeker/recommended" variant="secondary">
          See my matches
          <ArrowRight data-icon="inline-end" />
        </LinkButton>
      </div>
      <div className="portal-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Your recent applications"
            description="Every next step, in one place."
            action={
              <Link
                href="/jobseeker/applications"
                className="text-link text-[11px]"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            }
          >
            {applications.length ? (
              <ul className="flex flex-col divide-y">
                {applications.slice(0, 4).map((a) => {
                  const job = state.jobs.find((j) => j.id === a.jobId);
                  const company = state.employers.find(
                    (e) => e.id === job?.employerId,
                  );
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/jobseeker/applications/${a.id}`}
                        className="flex min-h-24 flex-wrap items-center gap-3 py-3"
                      >
                        <CompanyMark
                          initials={company?.initials ?? "J"}
                          color={company?.color}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-semibold leading-5">
                            {job?.title ?? "Unavailable vacancy"}
                          </h3>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {company?.name} · {formatDate(a.submittedAt)}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Your first opportunity is waiting."
                description="Explore jobs, choose a role that fits, and submit a application."
                href="/jobs"
              />
            )}
          </Panel>
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                Picked for your skills
              </h2>
              <Link
                className="text-link text-[11px]"
                href="/jobseeker/recommended"
              >
                All recommendations
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.map((job) => (
                <JobCard key={job.id} job={job} showMatch />
              ))}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Make a great first impression"
            description="A complete profile helps you apply with confidence."
          >
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-semibold text-teal">{completion}%</span>
            </div>
            <Progress
              value={completion}
              aria-label={`Profile ${completion}% complete`}
            />
            <ul className="mt-5 flex flex-col gap-3 text-xs text-muted-foreground">
              {[
                {
                  label: "Contact and community",
                  done: !!seeker.phone && !!seeker.barangay && !!seeker.address,
                },
                {
                  label: "Education and skills",
                  done: !!seeker.education && !!seeker.skills.length,
                },
                { label: "resume added", done: !!seeker.resumes.length },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <CheckCircle2
                    className={
                      item.done
                        ? "size-4 text-teal"
                        : "size-4 text-muted-foreground"
                    }
                  />
                  {item.label}
                </li>
              ))}
            </ul>
            <Link href="/jobseeker/profile" className="text-link mt-4 text-xs">
              {completion === 100 ? "Review my profile" : "Complete my profile"}
              <ArrowRight className="size-3" />
            </Link>
          </Panel>
          {interview && (
            <Panel
              title="Your next conversation"
              description="A interview is on your calendar."
            >
              <div className="teal-icon mb-4">
                <CalendarDays className="size-5" />
              </div>
              <h3 className="text-sm font-semibold">
                {state.jobs.find((j) => j.id === interview.jobId)?.title}
              </h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {formatDate(interview.interview!.date, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Asia/Manila",
                })}{" "}
                · Philippine time
                <br />
                {interview.interview!.location}
              </p>
              <Link
                className="text-link mt-3 text-xs"
                href={`/jobseeker/applications/${interview.id}`}
              >
                View interview details
                <ArrowRight className="size-3" />
              </Link>
            </Panel>
          )}
          <Panel
            title="A little heads-up"
            action={<Bell className="size-4 text-muted-foreground" />}
          >
            {notifications.length ? (
              <ul className="flex flex-col gap-4">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      className="text-xs font-medium leading-6 text-navy hover:text-primary"
                    >
                      {n.title}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(n.date)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-6 text-muted-foreground">
                You’re all caught up. We’ll show new updates here.
              </p>
            )}
            <Link
              href="/jobseeker/notifications"
              className="text-link mt-3 text-xs"
            >
              Open notifications
              <ArrowRight className="size-3" />
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
