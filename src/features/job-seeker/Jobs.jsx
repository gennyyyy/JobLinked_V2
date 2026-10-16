import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Clock,
  Banknote,
  ChevronLeft,
  ChevronRight,
  SearchX,
} from "lucide-react";
import { listJobs } from "../../shared/services/jobs";
import useAuth from "../../shared/hooks/useAuth";
import { SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import AiMatchModal from "./AiMatchModal";
import { PageHeader, StatCard, InlineError } from "../../shared/components/dashboard";
import { TagInput } from "../../shared/components/TagInput";
import useDialog from "../../shared/hooks/useDialog";
import { titleCase } from "../../shared/utils/titleCase";

function Jobs() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [employer, setEmployer] = useState("");
  const [skills, setSkills] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [order, setOrder] = useState("created_at.desc");
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState(null);
  const profileSkillsInitialized = useRef(false);
  const pageSize = 10;

  useEffect(() => {
    if (!user || profileSkillsInitialized.current) return;
    profileSkillsInitialized.current = true;
    const profileSkills = Array.isArray(user.skills) ? user.skills.join(", ") : "";
    if (profileSkills) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync of async profile value into local filter state
      setSkills(profileSkills);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      setLoading(true);
      setError("");
      try {
        const result = await listJobs({ search: query, location, employmentType, workArrangement, employer, skills, salaryMin: salaryMin ? Number(salaryMin) : null, order, page, pageSize });
        if (!cancelled) { setJobs(result.jobs); setTotal(result.total); }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [query, location, employmentType, workArrangement, employer, skills, salaryMin, order, page]);

  // Fetch from the debounced copy of the keyword so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setQuery(keyword), 350);
    return () => clearTimeout(t);
  }, [keyword]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Always offer every Santa Maria barangay, even when the current page of
  // jobs only mentions a few — plus any non-barangay location already in results.
  const locations = useMemo(
    () => [...new Set([...SANTA_MARIA_BARANGAYS, ...jobs.map((j) => j.location).filter(Boolean)])],
    [jobs]
  );

  const fullTimeCount = useMemo(
    () => jobs.filter((j) => j.employment_type === "Full-time").length,
    [jobs]
  );

  // The jobs API returns a total but no per-barangay count, so any barangay
  // figure below is scoped to the page actually rendered — label it that way.
  const barangaysOnPage = useMemo(
    () => new Set(jobs.map((j) => j.location).filter(Boolean)).size,
    [jobs]
  );

  const hasActiveFilters =
    keyword.trim() !== "" ||
    location !== "" ||
    employmentType !== "" ||
    workArrangement !== "" ||
    employer.trim() !== "" ||
    skills.trim() !== "" ||
    salaryMin !== "";

  const activeFilterCount = [location, employmentType, workArrangement, employer.trim(), skills.trim(), salaryMin].filter(Boolean).length;

  function resetFilters() {
    setKeyword(""); setLocation(""); setEmploymentType(""); setWorkArrangement(""); setEmployer(""); setSkills(""); setSalaryMin(""); setOrder("created_at.desc"); setPage(1);
  }

  function openFilters() {
    setFilterDraft({ location, employmentType, workArrangement, employer, skills, salaryMin, order });
    setFiltersOpen(true);
  }

  function applyFilters() {
    setLocation(filterDraft.location);
    setEmploymentType(filterDraft.employmentType);
    setWorkArrangement(filterDraft.workArrangement);
    setEmployer(filterDraft.employer);
    setSkills(filterDraft.skills);
    setSalaryMin(filterDraft.salaryMin);
    setOrder(filterDraft.order);
    setPage(1);
    setFiltersOpen(false);
  }

  function clearFilterDraft() {
    setFilterDraft({ location: "", employmentType: "", workArrangement: "", employer: "", skills: "", salaryMin: "", order: "created_at.desc" });
  }

  const inputClass =
    "min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary focus:bg-white transition-all w-full";

  const filtersRef = useDialog(() => setFiltersOpen(false), filtersOpen && Boolean(filterDraft));

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="OPPORTUNITIES IN SANTA MARIA"
        title="Browse Verified Openings"
        subtitle={<>{total} active position{total === 1 ? "" : "s"} available in Santa Maria</>}
      />

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {[
          { label: "Openings", count: total, icon: Briefcase },
          { label: "Barangays on This Page", count: barangaysOnPage, icon: MapPin },
          { label: "Full-time on This Page", count: fullTimeCount, icon: Clock },
        ].map((c) => {
          const MetricIcon = c.icon;
          return <StatCard key={c.label} label={c.label} value={c.count} icon={<MetricIcon className="w-4 h-4" />} />;
        })}
      </div>

      {/* Main Container: Search, Filters & Job List */}
      <section className="bg-white border border-primary rounded-lg p-5 shadow-xs space-y-5">
        {/* Search controls */}
        <form onSubmit={(e) => e.preventDefault()} className="pb-4 border-b border-gray-100">
          <div className="flex flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              aria-label="Open AI job matching"
              title="AI Job Matching"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors cursor-pointer"
            >
              <span className="text-xs font-bold tracking-wide">AI</span>
            </button>
            <div className="relative min-w-0 flex-1">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search jobs by title"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                placeholder="Search by job title..."
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary focus:bg-white transition-all"
              />
            </div>
            <button
              type="button"
              onClick={openFilters}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              className="inline-flex h-11 shrink-0 items-center gap-2 px-3 sm:px-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-primary/50 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && <span className="grid place-items-center min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-semibold">{activeFilterCount}</span>}
            </button>
          </div>
        </form>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-gray-500">
          <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Loading jobs…
        </div>
      ) : error ? (
        <InlineError message={error} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-lg bg-white border border-primary/30 hover:border-primary hover:shadow-sm transition-all p-5 flex flex-col min-h-[190px]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <Link
                      to={`/job-seeker/jobs/${job.id}`}
                      className="block font-semibold text-gray-900 hover:text-primary transition-colors line-clamp-1"
                    >
                      {job.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      <span>{titleCase(job.employers?.company_name || "Accredited Employer")}</span>
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 font-mono text-[11px] text-primary font-semibold shrink-0">
                  <Banknote className="w-3.5 h-3.5" />
                  {job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable"}
                </span>
              </div>
              {job.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mt-3 flex-1">{job.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
                  <MapPin className="w-3 h-3" />
                  {job.location || "Santa Maria"}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  <Clock className="w-3 h-3" />
                  {job.employment_type}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider bg-violet-50 border border-violet-200 text-violet-700 font-semibold">
                  {job.work_arrangement || "On-site"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-100">
                <span className="font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                  {job.vacancies ?? 1} slot{(job.vacancies ?? 1) === 1 ? "" : "s"}
                </span>
                <Link
                  to={`/job-seeker/jobs/${job.id}`}
                  className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all shrink-0"
                >
                  View & Apply <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <SearchX className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="font-semibold text-gray-900 mb-1">
            {hasActiveFilters ? "No openings match your filters" : "No openings right now"}
          </p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "Try adjusting your search or filters to discover more opportunities."
              : "Check back soon — newly verified openings will appear here."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <span className="font-mono text-[11px] tracking-wider text-gray-500 uppercase">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      </section>
      {filtersOpen && filterDraft && createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}
        >
          <section
            ref={filtersRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-filters-title"
            className="bg-white border border-primary rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 id="job-filters-title" className="text-lg font-semibold text-dark-blue">Find the right job</h2>
                <p className="mt-1 text-sm text-gray-500">Refine openings by your preferences.</p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="grid place-items-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              <label className="text-xs font-medium text-gray-700">
                Location / Barangay
                <select value={filterDraft.location} onChange={(event) => setFilterDraft({ ...filterDraft, location: event.target.value })} className={`${inputClass} mt-1.5`}>
                  <option value="">All locations</option>
                  {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700">
                Employment type
                <select value={filterDraft.employmentType} onChange={(event) => setFilterDraft({ ...filterDraft, employmentType: event.target.value })} className={`${inputClass} mt-1.5`}>
                  <option value="">All types</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contractual">Contractual</option>
                  <option value="Seasonal">Seasonal</option>
                  <option value="Job Order">Job Order</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700">
                Work arrangement
                <select value={filterDraft.workArrangement} onChange={(event) => setFilterDraft({ ...filterDraft, workArrangement: event.target.value })} className={`${inputClass} mt-1.5`}>
                  <option value="">All arrangements</option>
                  <option value="On-site">On-site</option>
                  <option value="Remote / Work from home">Remote / Work from home</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700">
                Sort by
                <select value={filterDraft.order} onChange={(event) => setFilterDraft({ ...filterDraft, order: event.target.value })} className={`${inputClass} mt-1.5`}>
                  <option value="created_at.desc">Newest</option>
                  <option value="salary_max.desc">Salary: High to Low</option>
                  <option value="salary_min.asc">Salary: Low to High</option>
                  <option value="title.asc">Title A–Z</option>
                  <option value="deadline.asc">Deadline</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700">
                Minimum salary (₱)
                <input type="number" min="0" value={filterDraft.salaryMin} onChange={(event) => setFilterDraft({ ...filterDraft, salaryMin: event.target.value })} placeholder="Any salary" className={`${inputClass} mt-1.5`} />
              </label>
              <div className="text-xs font-medium text-gray-700 sm:col-span-2">
                <p className="mb-1.5">Employers</p>
                <TagInput value={filterDraft.employer} onChange={(value) => setFilterDraft({ ...filterDraft, employer: value })} placeholder="Add an employer and press Enter" />
              </div>
              <div className="text-xs font-medium text-gray-700 sm:col-span-2">
                <p className="mb-1.5">Skills</p>
                <TagInput value={filterDraft.skills} onChange={(value) => setFilterDraft({ ...filterDraft, skills: value })} placeholder="Add a skill and press Enter" />
              </div>
            </div>
            <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
              <button type="button" onClick={clearFilterDraft} className="min-h-[44px] px-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                Clear filters
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setFiltersOpen(false)} className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={applyFilters} className="min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors">
                  Apply filters
                </button>
              </div>
            </footer>
          </section>
        </div>,
        document.body
      )}
      <AiMatchModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

export default Jobs;
