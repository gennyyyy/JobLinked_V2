import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listJobs } from "../../services/jobs";
import LoadingScreen from "../../components/LoadingScreen";

function Jobs() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [employer, setEmployer] = useState("");
  const [skills, setSkills] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [order, setOrder] = useState("created_at.desc");
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 10;

  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      setLoading(true);
      setError("");
      try {
        const result = await listJobs({ search, location, employmentType, employer, skills, salaryMin: salaryMin ? Number(salaryMin) : null, order, page, pageSize });
        if (!cancelled) { setJobs(result.jobs); setTotal(result.total); }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [search, location, employmentType, employer, skills, salaryMin, order, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const locations = [...new Set(jobs.map((j) => j.location).filter(Boolean))];

  function resetFilters() {
    setSearch(""); setLocation(""); setEmploymentType(""); setEmployer(""); setSkills(""); setSalaryMin(""); setPage(1);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">OPPORTUNITIES IN SANTA MARIA</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Browse Verified Openings</h1>
        <p className="mt-2 text-sm text-gray-500">{total} active position{total === 1 ? "" : "s"} available across 24 barangays</p>
      </header>

      <form onSubmit={(e) => e.preventDefault()} className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-3 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by job title..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <input
          type="text"
          value={employer}
          onChange={(e) => { setEmployer(e.target.value); setPage(1); }}
          placeholder="Employer..."
          className="sm:w-44 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <input
          type="text"
          value={skills}
          onChange={(e) => { setSkills(e.target.value); setPage(1); }}
          placeholder="Skills (comma-separated)..."
          className="sm:w-44 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={location}
          onChange={(e) => { setLocation(e.target.value); setPage(1); }}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="">All Locations</option>
          {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        <select
          value={employmentType}
          onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="">All Types</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Contractual">Contractual</option>
          <option value="Seasonal">Seasonal</option>
          <option value="Job Order">Job Order</option>
        </select>
        <input
          type="number"
          min="0"
          value={salaryMin}
          onChange={(e) => { setSalaryMin(e.target.value); setPage(1); }}
          placeholder="Min ₱ salary"
          className="sm:w-36 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={order}
          onChange={(e) => { setOrder(e.target.value); setPage(1); }}
          aria-label="Sort jobs"
          className="min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="created_at.desc">Newest</option>
          <option value="salary_max.desc">Salary: High to Low</option>
          <option value="salary_min.asc">Salary: Low to High</option>
          <option value="title.asc">Title A–Z</option>
          <option value="deadline.asc">Deadline</option>
        </select>
      </form>

      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <div className="py-16 text-center text-sm text-danger">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/job-seeker/jobs/${job.id}`}
              className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-widest text-gray-400 uppercase">{job.location} · {job.employment_type}</span>
                  <span className="text-gray-300 group-hover:text-primary transition-colors text-sm">↗</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-1">{job.title}</h2>
                <p className="text-xs text-gray-500 mt-1">{job.employers?.company_name}</p>
                {job.description && <p className="mt-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">{job.description}</p>}
              </div>
              <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="inline-flex px-3 py-1 rounded-full bg-primary/10 border border-primary/25 font-mono text-xs text-primary font-medium">
                  {job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable"}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-gray-900 transition-colors">Apply now →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="py-16 text-center bg-gray-50 border border-gray-200 rounded-2xl">
          <p className="text-sm text-gray-500">No openings match your search filters.</p>
          <button onClick={resetFilters} className="mt-4 text-xs font-mono text-[#0057B8] hover:underline">
            Reset filters
          </button>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default Jobs;
