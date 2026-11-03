import { BARANGAYS } from "@/constants";
import type { DemoState, Report } from "@/types";

export function buildReport(s: DemoState, from: string, to: string): Report {
  const within = (date: string) =>
    date.slice(0, 10) >= from && date.slice(0, 10) <= to;
  const applications = s.applications.filter((a) => within(a.submittedAt));
  const jobs = s.jobs.filter(
    (j) =>
      within(j.postedAt) &&
      j.status === "Published" &&
      s.employers.find((e) => e.id === j.employerId)?.accreditationStatus ===
        "Approved",
  );
  const placements = applications.filter((a) => a.status === "Hired");
  const months = new Map<
    string,
    { month: string; applications: number; placements: number }
  >();
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
  for (let i = 0; cursor <= end && i < 121; i++) {
    const key = cursor.toISOString().slice(0, 7);
    months.set(key, {
      month: new Intl.DateTimeFormat("en-PH", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(cursor),
      applications: 0,
      placements: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const application of applications) {
    const key = application.submittedAt.slice(0, 7);
    const row = months.get(key) ?? {
      month: new Intl.DateTimeFormat("en-PH", {
        month: "short",
        year: "2-digit",
      }).format(new Date(application.submittedAt)),
      applications: 0,
      placements: 0,
    };
    row.applications++;
    if (application.status === "Hired") row.placements++;
    months.set(key, row);
  }
  return {
    generatedAt: new Date().toISOString(),
    from,
    to,
    vacancies: jobs.length,
    openings: jobs.reduce((sum, j) => sum + j.openings, 0),
    applications: applications.length,
    referrals: applications.filter((a) => a.referred).length,
    placements: placements.length,
    barangays: BARANGAYS.map((name) => {
      const seekerIds = s.seekers
        .filter((p) => p.barangay === name)
        .map((p) => p.id);
      return {
        name,
        seekers: seekerIds.length,
        vacancies: jobs.filter((j) => j.barangay === name).length,
        applications: applications.filter((a) => seekerIds.includes(a.seekerId))
          .length,
        placements: placements.filter((a) => seekerIds.includes(a.seekerId))
          .length,
      };
    }),
    months: Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value),
  };
}
