import { useEffect, useMemo, useState } from "react";
import { listAllJobs, listAllApplications, listUsers } from "../../shared/services/admin";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { PageHeader, StatCard, SectionCard } from "../../shared/components/dashboard";

const REPORTS = [
  { id: "referral", label: "Referral", eyebrow: "Referral activity", description: "Track applicants referred through PESO services." },
  { id: "placement", label: "Placement Summary", eyebrow: "Employment outcomes", description: "Review applicants marked as placed and their hiring details." },
  { id: "registration", label: "Applicant Registration", eyebrow: "Applicant growth", description: "See job seeker registrations within the selected period." },
  { id: "vacancy", label: "Vacancy Solicitation", eyebrow: "Employer demand", description: "Review vacancies posted by participating employers." },
];
const PAGE_SIZE = 10;
const dateValue = (value) => value ? new Date(value).toLocaleDateString() : "—";

function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState("referral");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    // ponytail: the stat cards aggregate client-side, so the page asks for the
    // 500-row max; move these aggregations server-side when reports outgrow it.
    Promise.all([
      listAllJobs({ pageSize: 500 }),
      listAllApplications({ pageSize: 500 }),
      listUsers({ pageSize: 500 }),
    ])
      .then(([jobRows, applicationRows, userRows]) => {
        setJobs(jobRows.data);
        setApplications(applicationRows.data);
        setUsers(userRows.data);
      })
      .catch((err) => setError(err.message || "Could not load report data."))
      .finally(() => setLoading(false));
  }, []);

  const inRange = (value) => {
    if (!value) return true;
    const day = value.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  };
  const seekers = users.filter((user) => user.role === "job-seeker" && inRange(user.created_at));
  const vacancies = jobs.filter((job) => inRange(job.created_at));
  const periodApplications = applications.filter((application) => inRange(application.applied_at));
  const placed = periodApplications.filter((application) => application.status?.toLowerCase() === "placed");

  const reportRows = useMemo(() => {
    if (active === "placement") return placed;
    if (active === "registration") return seekers;
    if (active === "vacancy") return vacancies;
    return [];
  }, [active, placed, seekers, vacancies]);
  const pages = Math.max(1, Math.ceil(reportRows.length / PAGE_SIZE));
  const visibleRows = reportRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = REPORTS.find((item) => item.id === active);

  function downloadCSV() {
    const fields = active === "placement"
      ? [["Applicant", "Vacancy", "Employer", "Placed date"], placed.map((row) => [row.seeker?.full_name, row.job?.title, row.job?.employers?.company_name, row.applied_at])]
      : active === "registration"
        ? [["Applicant", "Email", "Barangay", "Registered"], seekers.map((row) => [row.full_name, row.email, row.barangay_district, row.created_at])]
        : active === "vacancy"
          ? [["Vacancy", "Employer", "Location", "Status", "Posted"], vacancies.map((row) => [row.title, row.employers?.company_name, row.location, row.status, row.created_at])]
          : [["Referral", "Status", "Date"], []];
    const csv = [fields[0], ...fields[1]].map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${active}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  return (
    <div className="space-y-6 bg-gray-50">
      <PageHeader
        eyebrow="REPORTS & ANALYTICS"
        title="Reports"
        subtitle="A clear view of referrals, employment outcomes, applicant growth, and employer demand."
      />

      <nav aria-label="Report types" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {REPORTS.map((report) => (
          <button
            key={report.id}
            type="button"
            onClick={() => { setActive(report.id); setPage(1); }}
            aria-current={active === report.id ? "page" : undefined}
            className={`rounded-xl px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${active === report.id ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            <span className="block text-sm font-semibold">{report.label}</span>
            <span className={`mt-0.5 block text-xs ${active === report.id ? "text-white/70" : "text-gray-500"}`}>{report.eyebrow}</span>
          </button>
        ))}
      </nav>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.15em] text-primary uppercase">{current.eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold text-dark-blue">{current.label}</h2>
          <p className="mt-1 text-sm text-gray-500">{current.description}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs text-gray-500">
            From
            <input aria-label="From date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-dark-blue focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </label>
          <label className="grid gap-1 text-xs text-gray-500">
            To
            <input aria-label="To date" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-dark-blue focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </label>
          <button type="button" onClick={downloadCSV} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            Download CSV
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {active === "placement" && (
          <>
            <StatCard label="Placed applicants" value={placed.length} />
            <StatCard label="Applications reviewed" value={periodApplications.length} />
            <StatCard label="Placement rate (of applications in period)" value={`${periodApplications.length ? Math.round(placed.length / periodApplications.length * 100) : 0}%`} />
          </>
        )}
        {active === "registration" && (
          <>
            <StatCard label="New applicants" value={seekers.length} />
            <StatCard label="All applicants" value={users.filter((user) => user.role === "job-seeker").length} />
            <StatCard label="Period" value={from || to ? "Selected" : "All time"} />
          </>
        )}
        {active === "vacancy" && (
          <>
            <StatCard label="Vacancies posted" value={vacancies.length} />
            <StatCard label="Open vacancies" value={vacancies.filter((job) => job.status === "published").length} />
            <StatCard label="Employers posting" value={new Set(vacancies.map((job) => job.company_id).filter(Boolean)).size} />
          </>
        )}
        {active === "referral" && (
          <>
            <StatCard label="Referrals recorded" value="—" />
            <StatCard label="Applicants referred" value="—" />
            <StatCard label="Period" value={from || to ? "Selected" : "All time"} />
          </>
        )}
      </div>

      <SectionCard title="Report details" subtitle={`${reportRows.length} records`}>
        {active === "referral" ? (
          <div className="py-10 text-center">
            <p className="text-base font-semibold text-dark-blue">Referral data is not available yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Once referral activity is recorded, this report will show applicants, referring source, and referral date.</p>
          </div>
        ) : reportRows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-dark-blue">No records in this period</p>
            <p className="mt-1 text-sm text-gray-500">Adjust the date range to see more results.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                  {active === "placement" && (
                    <>
                      <th scope="col" className="px-4 py-3 font-medium first:pl-0">Applicant</th>
                      <th scope="col" className="px-4 py-3 font-medium">Vacancy</th>
                      <th scope="col" className="px-4 py-3 font-medium">Employer</th>
                      <th scope="col" className="px-4 py-3 font-medium last:pr-0">Placed</th>
                    </>
                  )}
                  {active === "registration" && (
                    <>
                      <th scope="col" className="px-4 py-3 font-medium first:pl-0">Applicant</th>
                      <th scope="col" className="px-4 py-3 font-medium">Email</th>
                      <th scope="col" className="px-4 py-3 font-medium">Barangay</th>
                      <th scope="col" className="px-4 py-3 font-medium last:pr-0">Registered</th>
                    </>
                  )}
                  {active === "vacancy" && (
                    <>
                      <th scope="col" className="px-4 py-3 font-medium first:pl-0">Vacancy</th>
                      <th scope="col" className="px-4 py-3 font-medium">Employer</th>
                      <th scope="col" className="px-4 py-3 font-medium">Location</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium last:pr-0">Posted</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50/60">
                    {active === "placement" && (
                      <>
                        <th scope="row" className="px-4 py-4 font-medium text-dark-blue text-left first:pl-0">{row.seeker?.full_name || "—"}</th>
                        <td className="px-4 py-4 text-gray-600">{row.job?.title || "—"}</td>
                        <td className="px-4 py-4 text-gray-600">{row.job?.employers?.company_name || "—"}</td>
                        <td className="px-4 py-4 text-gray-500 last:pr-0">{dateValue(row.applied_at)}</td>
                      </>
                    )}
                    {active === "registration" && (
                      <>
                        <th scope="row" className="px-4 py-4 font-medium text-dark-blue text-left first:pl-0">{row.full_name || "—"}</th>
                        <td className="px-4 py-4 text-gray-600">{row.email || "—"}</td>
                        <td className="px-4 py-4 text-gray-600">{row.barangay_district || "—"}</td>
                        <td className="px-4 py-4 text-gray-500 last:pr-0">{dateValue(row.created_at)}</td>
                      </>
                    )}
                    {active === "vacancy" && (
                      <>
                        <th scope="row" className="px-4 py-4 font-medium text-dark-blue text-left first:pl-0">{row.title || "—"}</th>
                        <td className="px-4 py-4 text-gray-600">{row.employers?.company_name || "—"}</td>
                        <td className="px-4 py-4 text-gray-600">{row.location || "—"}</td>
                        <td className="px-4 py-4 text-gray-600">{row.status || "—"}</td>
                        <td className="px-4 py-4 text-gray-500 last:pr-0">{dateValue(row.created_at)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {active !== "referral" && reportRows.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default Reports;
