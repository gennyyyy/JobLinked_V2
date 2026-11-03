"use client";
import { hasPermission } from "@/lib/permissions";

import { useState } from "react";
import useSWR from "swr";
import {
  Download,
  Printer,
  BriefcaseBusiness,
  Users,
  Handshake,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  TextField,
  StatCards,
  Notice,
} from "@/components/shared";
import {
  EmploymentActivityChart,
  BarangayVacancyChart,
  EmploymentTypeChart,
} from "@/components/dashboard/employment-charts";
import { useDemo } from "@/hooks/use-demo";
import { downloadCsv, formatDate } from "@/lib/format";
import { JOB_TYPES } from "@/constants";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const quarterStart = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};

export function LaborMarketReports() {
  const { state, user, api } = useDemo();
  const [from, setFrom] = useState(quarterStart);
  const [to, setTo] = useState(today);
  const valid =
    !!from &&
    !!to &&
    from <= to &&
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000 <= 3660;
  const {
    data: report,
    error,
    isLoading,
  } = useSWR(
    hasPermission(state, user, "reports") && valid
      ? ["joblinked-report", from, to, state.revision]
      : null,
    () => api.getReport(from, to),
    { keepPreviousData: false, revalidateOnFocus: false },
  );
  const jobs = state.jobs.filter(
    (j) =>
      j.postedAt.slice(0, 10) >= from &&
      j.postedAt.slice(0, 10) <= to &&
      j.status === "Published" &&
      state.employers.some(
        (e) => e.id === j.employerId && e.accreditationStatus === "Approved",
      ),
  );
  const exportReport = () => {
    if (!report) return;
    downloadCsv(
      `joblinked-DEMO-barangay-report-${from}-to-${to}.csv`,
      [
        "DEMO DATA — Barangay",
        "Registered residents (all time)",
        "Currently published vacancies posted in period",
        "Applications submitted in period",
        "Current hired outcomes from those applications",
        "Period start",
        "Period end",
      ],
      report.barangays.map((row) => [
        row.name,
        row.seekers,
        row.vacancies,
        row.applications,
        row.placements,
        from,
        to,
      ]),
    );
  };
  return (
    <>
      <div className="print-title mb-5 hidden">
        <p className="text-xl font-semibold">
          JobLinked ·  Labor Market Report
        </p>
        <p className="text-xs">
          Provided data only. Not an official municipal report.
        </p>
      </div>
      <PageHeading
        eyebrow="A more informed local picture"
        title="Insights that keep people at the center."
        description="Explore provided vacancies, referrals, and placement outcomes across Santa Maria’s 24 barangays."
        action={
          <>
            <Button
              variant="outline"
              disabled={!report || !valid}
              onClick={exportReport}
            >
              <Download data-icon="inline-start" />
              Download  CSV
            </Button>
            <Button
              variant="outline"
              disabled={!report || !valid}
              onClick={() => window.print()}
            >
              <Printer data-icon="inline-start" />
              Print report
            </Button>
          </>
        }
      />
      <div className="surface no-print mb-6">
        <FieldGroup>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <TextField
              label="Report period: from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              label="Report period: to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </FieldGroup>
        {!valid && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            Select an ordered date range of no more than ten years.
          </p>
        )}
      </div>
      {error && (
        <Notice title="Report could not be generated" warning>
          {error.message}
        </Notice>
      )}
      {isLoading && (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      )}
      {report && valid && (
        <>
          <p className="mb-5 text-xs text-muted-foreground">
            {formatDate(from)} – {formatDate(to)} · Generated{" "}
            {formatDate(report.generatedAt)} · Current records only
          </p>
          <StatCards
            stats={[
              {
                label: "Published vacancy records",
                value: report.vacancies,
                icon: BriefcaseBusiness,
                note: `${report.openings} openings in these postings`,
              },
              {
                label: "applications",
                value: report.applications,
                icon: ClipboardCheck,
              },
              {
                label: "Recorded  referrals",
                value: report.referrals,
                icon: Handshake,
                tone: "teal",
              },
              {
                label: "placements",
                value: report.placements,
                icon: Users,
                tone: "teal",
              },
            ]}
          />
          <div className="mb-6">
            <Notice title="How to read this report">
              All data is provided. Applications are grouped by submission
              date; placements and referrals reflect their current  outcome.
              Vacancy counts include currently published postings from approved
              employers posted in the selected period. Resident counts are
              all-time registrations, not municipal population data.
            </Notice>
          </div>
          <div className="mb-6 grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel
              title="Applications & placement outcomes"
              description="Monthly submissions and their current hired outcomes."
            >
              <EmploymentActivityChart data={report.months} />
            </Panel>
            <Panel
              title="Opportunity by employment type"
              description="Currently published vacancy records."
            >
              <EmploymentTypeChart
                data={JOB_TYPES.map((name) => ({
                  name,
                  value: jobs.filter((j) => j.type === name).length,
                }))}
              />
            </Panel>
          </div>
          <div className="mb-6 grid items-start gap-6 xl:grid-cols-[1fr_1.4fr]">
            <Panel
              title="Where opportunities are growing"
              description="Top six barangays by vacancy records."
            >
              <BarangayVacancyChart data={report.barangays} />
            </Panel>
            <Panel
              title="A clear view of the numbers"
              description="Definitions matter more than a headline number."
            >
              <dl className="flex flex-col gap-5 text-xs">
                <div>
                  <dt className="font-semibold text-navy">
                    Vacancy record ≠ opening
                  </dt>
                  <dd className="mt-2 leading-6 text-muted-foreground">
                    One posting can include multiple openings. This period has{" "}
                    {report.vacancies} postings with {report.openings}{" "}
                    openings.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy">Referral marker</dt>
                  <dd className="mt-2 leading-6 text-muted-foreground">
                    An administrator recorded a  referral. No external
                    message or referral form was sent.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy">Placement outcome</dt>
                  <dd className="mt-2 leading-6 text-muted-foreground">
                    An employer marked an application Hired. This is not
                    independently verified employment.
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>
          <Panel
            title="Across all 24 barangays"
            description="Zero values are retained so every barangay remains represented."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barangay</TableHead>
                  <TableHead>Residents*</TableHead>
                  <TableHead>Vacancies</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Placements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.barangays.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium text-navy">
                      {row.name}
                    </TableCell>
                    <TableCell>{row.seekers}</TableCell>
                    <TableCell>{row.vacancies}</TableCell>
                    <TableCell>{row.applications}</TableCell>
                    <TableCell>{row.placements}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-4 text-[10px] leading-6 text-muted-foreground">
              *All-time provided registered residents. Other columns follow the
              selected period and definitions above. For platform review only;
              not official Labor Market Information.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
