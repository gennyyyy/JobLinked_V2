import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listJobs } from "../services/jobs";
import TextBasedLogo from "../assets/TextBased Logo.png";
import LoadingScreen from "../components/LoadingScreen";

function JobBrowser({ initialKeyword, initialLocation }) {
  const [search, setSearch] = useState(initialKeyword);
  const [location, setLocation] = useState(initialLocation);
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
        const result = await listJobs({ search, location, page, pageSize });
        if (!cancelled) { setJobs(result.jobs); setTotal(result.total); }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [search, location, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const locations = [...new Set(jobs.map((j) => j.location).filter(Boolean))];

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-3 shadow-sm mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by job title or employer..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={location}
          onChange={(e) => { setLocation(e.target.value); setPage(1); }}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="">All Locations</option>
          {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </form>

      <div className="flex items-center justify-between mb-6">
        <p className="font-mono text-[11px] tracking-widest text-gray-400 uppercase">
          {total} OPENING{total === 1 ? "" : "S"} FOUND
        </p>
        <span className="inline-flex items-center gap-2 font-mono text-[11px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-[#0057B8] animate-pulse" />
          Live PESO Bulletin
        </span>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <div className="py-16 text-center text-sm text-danger">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
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
                <span className="text-xs text-gray-400 group-hover:text-gray-900 transition-colors">View details →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="py-16 text-center bg-gray-50 border border-gray-200 rounded-2xl">
          <p className="text-sm text-gray-500">No jobs match your search criteria.</p>
          <button onClick={() => { setSearch(""); setLocation(""); }} className="mt-4 text-xs font-mono text-[#0057B8] hover:underline">Clear all filters</button>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">← Prev</button>
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">Next →</button>
        </div>
      )}
    </>
  );
}

function PublicJobs() {
  const [searchParams] = useSearchParams();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-dark-blue/90 backdrop-blur border-b border-white/10">
        <div className="w-full px-4 h-[56px] flex items-center justify-between">
          <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
            <Link to="/"><img src={TextBasedLogo} alt="JobLinked" className="h-6" /></Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/register" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Register</Link>
            <Link to="/portals" className="min-h-[36px] inline-flex items-center px-4 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">Log In</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full p-[3%] animate-fade-in">
        <div className="mb-8">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">PUBLIC EMPLOYMENT BULLETINS</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-dark-blue">Find Openings in Santa Maria</h1>
          <p className="mt-3 text-sm md:text-base text-gray-500 max-w-2xl">Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal.</p>
        </div>

        <JobBrowser
          key={searchParams.toString()}
          initialKeyword={searchParams.get("keyword") || ""}
          initialLocation={searchParams.get("location") || ""}
        />
      </main>

      <footer className="border-t border-gray-200 bg-dark-blue text-white/30">
        <div className="w-full px-4 py-3 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">Job<span className="text-[#0057B8]">Linked</span> <span className="text-white/40">PESO</span></span>
          <span>Santa Maria Municipal Hall · hello@joblinked.ph</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default PublicJobs;
