import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, SearchX } from "lucide-react";
import { listJobs } from "../services/jobs";
import { TagInput } from "./TagInput";
import { InlineError, Pager } from "./dashboard";

const PAGE_SIZE = 10;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contractual", "Seasonal", "Job Order"];
const MAX_SKILLS = 3;

// Requirements arrive as one free-text blob; the design shows a short bullet
// list, so split on newlines and keep the first few.
function requirementLines(requirements) {
  return String(requirements || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function salaryLabel(job) {
  return job.salary_min
    ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}`
    : "Negotiable";
}

// Plain local "YYYY-MM-DD HH:mm:ss" stamp, as the design shows it.
function formatPosted(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Shared browse/search page: top search bar, skills + employment-type sidebar,
// and the paginated results list. Both the public bulletin and the seeker
// portal render this, differing only in the job-detail link and toolbar slot.
function BrowseJobs({ jobHref, initialKeyword = "", initialLocation = "", initialSkills = [], toolbar = null }) {
  const seedSkills = (Array.isArray(initialSkills) ? initialSkills : []).slice(0, MAX_SKILLS).join(", ");
  const [keyword, setKeyword] = useState(initialKeyword);
  const [location, setLocation] = useState(initialLocation);
  const [skillsDraft, setSkillsDraft] = useState(seedSkills);
  const [employmentTypeDraft, setEmploymentTypeDraft] = useState("");
  const [applied, setApplied] = useState({ query: initialKeyword, location: initialLocation, employmentType: "", skills: seedSkills });
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      setLoading(true);
      setError("");
      try {
        const result = await listJobs({
          search: applied.query,
          location: applied.location,
          employmentType: applied.employmentType,
          skills: applied.skills,
          page,
          pageSize: PAGE_SIZE,
          order: "created_at.desc",
        });
        if (!cancelled) { setJobs(result.jobs); setTotal(result.total); }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [applied, page]);

  // Fetch from the debounced copy of the keyword so each keystroke doesn't hit
  // the API. Same value => same state object, so seeding never re-fetches.
  useEffect(() => {
    const t = setTimeout(() => setApplied((a) => (a.query === keyword ? a : { ...a, query: keyword })), 350);
    return () => clearTimeout(t);
  }, [keyword]);

  function handleSearch(event) {
    event.preventDefault();
    setApplied((a) => ({ ...a, query: keyword, location }));
    setPage(1);
  }

  function refine() {
    setApplied((a) => ({ ...a, skills: skillsDraft, employmentType: employmentTypeDraft }));
    setPage(1);
  }

  function clearFilters() {
    setKeyword("");
    setLocation("");
    setSkillsDraft("");
    setEmploymentTypeDraft("");
    setApplied({ query: "", location: "", employmentType: "", skills: "" });
    setPage(1);
  }

  const inputClass =
    "min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary focus:bg-white transition-all w-full";

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} role="search" className="bg-white border border-primary rounded-lg p-3 flex flex-col sm:flex-row sm:flex-nowrap items-stretch sm:items-center gap-2">
        {toolbar}
        <div className="relative min-w-0 flex-1">
          <label htmlFor="browse-jobs-keyword" className="sr-only">Search for a job title or company</label>
          <Search aria-hidden="true" className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="browse-jobs-keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="search for a Job Title or company"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="relative min-w-0 flex-1">
          <label htmlFor="browse-jobs-location" className="sr-only">Location</label>
          <MapPin aria-hidden="true" className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="browse-jobs-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className={`${inputClass} pl-10`}
          />
        </div>
        <button
          type="submit"
          className="min-h-[44px] px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors cursor-pointer shrink-0"
        >
          Search
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        <aside className="bg-white border border-primary rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-dark-blue">Filter by Skills:</h2>
            <p className="mt-1 font-mono text-[10px] tracking-widest text-gray-500 uppercase">Select up to {MAX_SKILLS} skills</p>
          </div>
          <div>
            <label htmlFor="browse-jobs-skills" className="sr-only">Skills</label>
            <TagInput id="browse-jobs-skills" value={skillsDraft} onChange={setSkillsDraft} max={MAX_SKILLS} placeholder="Search for skills" />
          </div>
          <div>
            <label htmlFor="browse-jobs-employment" className="block text-xs font-medium text-gray-700 mb-1.5">Employment Type:</label>
            <select
              id="browse-jobs-employment"
              value={employmentTypeDraft}
              onChange={(e) => setEmploymentTypeDraft(e.target.value)}
              className={inputClass}
            >
              <option value="">All types</option>
              {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={refine}
            className="w-full min-h-[44px] rounded-xl bg-dark-blue text-white text-sm font-semibold hover:bg-primary transition-colors cursor-pointer"
          >
            Refine Search Results
          </button>
        </aside>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-dark-blue">Displaying {jobs.length} out of {total} jobs:</h2>

          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-primary bg-white py-10 text-sm text-gray-500">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Loading jobs…
            </div>
          ) : error ? (
            <InlineError message={error} />
          ) : jobs.length === 0 ? (
            <div className="rounded-lg border border-primary bg-white px-6 py-12 text-center">
              <SearchX className="mx-auto mb-3 w-8 h-8 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
              <p className="font-semibold text-gray-900">No jobs match your search</p>
              <p className="mt-1 text-sm text-gray-500">Try another keyword, location, or skill.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 min-h-[44px] px-4 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => {
                const bullets = requirementLines(job.requirements);
                return (
                  <li key={job.id}>
                    <article className="rounded-lg border border-primary bg-white p-5">
                      <h3 className="text-base font-bold text-danger">
                        <Link to={jobHref(job.id)} className="hover:underline">{job.title}</Link>
                      </h3>
                      <p className="mt-1 text-[11px] text-gray-500">Posted on {formatPosted(job.created_at)}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        <span className="font-semibold">Salary</span> {salaryLabel(job)}
                      </p>
                      {job.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{job.description}</p>}
                      {bullets.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 space-y-0.5 text-xs text-gray-600">
                          {bullets.map((line) => <li key={line}>{line}</li>)}
                        </ul>
                      )}
                      <Link to={jobHref(job.id)} className="mt-3 inline-block text-xs italic text-danger hover:underline">See more</Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </section>
      </div>
    </div>
  );
}

export default BrowseJobs;
