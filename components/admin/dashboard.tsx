"use client";

import Link from "next/link";
import {
  Users,
  Building2,
  ShieldCheck,
  BriefcaseBusiness,
  ArrowRight,
  Handshake,
  ClipboardCheck,
  ChartNoAxesCombined,
} from "lucide-react";
import {
  PageHeading,
  Panel,
  StatCards,
  LinkButton,
  StatusBadge,
  CompanyMark,
} from "@/components/shared";
import { EmploymentActivityChart } from "@/components/dashboard/employment-charts";
import { useDemo } from "@/hooks/use-demo";
import { EmploymentTracking } from "@/components/tracking/employment-tracking";
import { formatDate, isJobOpen } from "@/lib/format";

export function AdminDashboard() {
  const { state, user } = useDemo();
  if (user?.role === "staff") return <EmploymentTracking mode="admin" />;
  const pending = state.accreditations.filter(
    (a) => a.status === "Pending Review",
  );
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 13 + i);
    const key = date.toISOString().slice(0, 10);
    const applications = state.applications.filter(
      (a) => a.submittedAt.slice(0, 10) === key,
    );
    return {
      month: new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
      }).format(date),
      applications: applications.length,
      placements: applications.filter((a) => a.status === "Hired").length,
    };
  });
  return (
    <>
      <PageHeading
        eyebrow="Connect people. Strengthen community."
        title="A clearer picture of local opportunity."
        description={`Welcome, ${user?.name.split(" ")[0] ?? "reviewer"}. Here’s your Santa Maria employment workspace at a glance.`}
        action={
          <LinkButton href="/admin/reports" variant="outline">
            <ChartNoAxesCombined data-icon="inline-start" />
            View  reports
          </LinkButton>
        }
      />
      <StatCards
        stats={[
          {
            label: "Registered job seekers",
            value: state.seekers.length,
            icon: Users,
          },
          {
            label: "Local employers",
            value: state.employers.length,
            icon: Building2,
          },
          {
            label: "Pending accreditations",
            value: pending.length,
            icon: ShieldCheck,
            note: "submissions awaiting review",
            tone: "teal",
          },
          {
            label: "Active vacancies",
            value: state.jobs.filter(
              (j) =>
                isJobOpen(j) &&
                state.employers.some(
                  (e) =>
                    e.id === j.employerId &&
                    e.accreditationStatus === "Approved",
                ),
            ).length,
            icon: BriefcaseBusiness,
            tone: "teal",
          },
        ]}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "applications",
            value: state.applications.length,
            icon: ClipboardCheck,
          },
          {
            label: "Recorded  referrals",
            value: state.applications.filter((a) => a.referred).length,
            icon: Handshake,
          },
          {
            label: "placements",
            value: state.applications.filter((a) => a.status === "Hired")
              .length,
            icon: Users,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4"
          >
            <span className="teal-icon">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-navy">{value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="portal-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Local employment activity"
            description="Last 14 days · Provided applications grouped by submission date; placements reflect current outcomes."
          >
            <EmploymentActivityChart data={days} />
          </Panel>
          <Panel
            title="Accreditation review queue"
            description="Help local employers take the next step."
            action={
              <Link
                className="text-link text-[11px]"
                href="/admin/accreditation"
              >
                Open queue
                <ArrowRight className="size-3" />
              </Link>
            }
          >
            <ul className="flex flex-col divide-y">
              {pending.slice(0, 4).map((item) => {
                const company = state.employers.find(
                  (e) => e.id === item.employerId,
                )!;
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 py-4"
                  >
                    <CompanyMark
                      initials={company.initials}
                      color={company.color}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-navy">
                        {company.name}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {company.barangay} · Submitted{" "}
                        {formatDate(item.submittedAt)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                );
              })}
              {!pending.length && (
                <li className="py-5 text-xs text-muted-foreground">
                  No pending accreditations. Your review queue is up to
                  date.
                </li>
              )}
            </ul>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="rounded-2xl bg-navy p-6 text-white">
            <p className="text-[10px] font-medium tracking-widest text-white/65 uppercase">
              One municipality. Many possibilities.
            </p>
            <h2 className="mt-4 text-xl font-semibold text-white">
              Every connection matters.
            </h2>
            <p className="mt-3 text-xs leading-6 text-white/70">
              Explore the  across Santa Maria’s 24 barangays. All numbers
              represent provided records, not actual municipal statistics.
            </p>
            <LinkButton
              href="/admin/reports"
              variant="secondary"
              className="mt-5"
            >
              Explore barangay insights
              <ArrowRight data-icon="inline-end" />
            </LinkButton>
          </div>
          <Panel
            title="Recent workspace activity"
            description="changes across all three roles."
          >
            <ol className="flex flex-col gap-5">
              {state.auditLogs.slice(0, 5).map((log) => (
                <li key={log.id} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs font-medium leading-5 text-navy">
                      {log.action}
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                      {log.target} · {log.actor}
                    </p>
                    <time
                      className="text-[10px] text-muted-foreground"
                      dateTime={log.date}
                    >
                      {formatDate(log.date)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/admin/audit" className="text-link mt-4 text-xs">
              View full audit log
              <ArrowRight className="size-3" />
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
