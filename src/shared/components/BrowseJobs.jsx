import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, BriefcaseBusiness, Check, MapPin, Search, SearchX } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { getSavedJobIds, subscribeSavedJobs, toggleSavedJob } from "../lib/savedJobs";
import { listJobs } from "../services/jobs";
import { TagInput } from "./TagInput";
import { InlineError, Pager } from "./dashboard";
import { CompanyMark } from "./design";
import { JobListSkeleton } from "./Skeletons";
import { prefetchRoute } from "../lib/routeLoaders";
import { titleCase } from "../utils/titleCase";

const PAGE_SIZE = 10;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contractual", "Seasonal", "Casual", "Job Order", "Project-based", "Internship"];
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
    ? `₱${job.salary_min}${job.salary_max ? ` – ₱${job.salary_max}` : ""}`
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
  const { user } = useAuth() || {};
  const [savedIds, setSavedIds] = useState(() => getSavedJobIds());
  const canSave = user?.role === "job-seeker";

  useEffect(() => subscribeSavedJobs(() => setSavedIds(getSavedJobIds())), []);

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
        // Trust boundary: a malformed/legacy payload must not white-screen the
        // job list — fall back to an empty page instead of undefined state.
        if (!cancelled) {
          setJobs(Array.isArray(result?.jobs) ? result.jobs : []);
          setTotal(Number(result?.total) || 0);
        }
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
    "min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-card transition-all w-full";

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} role="search" className="bg-card border border-primary rounded-lg p-3 flex flex-col sm:flex-row sm:flex-nowrap items-stretch sm:items-center gap-2">
        {toolbar}
        <div className="relative min-w-0 flex-1">
          <Label htmlFor="browse-jobs-keyword" className="sr-only">Search for a job title or company</Label>
          <Search aria-hidden="true" className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            id="browse-jobs-keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="search for a Job Title or company"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="relative min-w-0 flex-1">
          <Label htmlFor="browse-jobs-location" className="sr-only">Location</Label>
          <MapPin aria-hidden="true" className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            id="browse-jobs-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className={`${inputClass} pl-10`}
          />
        </div>
        <Button
          type="submit"
          className="min-h-[44px] px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors cursor-pointer shrink-0"
        >
          Search
        </Button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Floats alongside the results: the filter column stays in view while the
            list scrolls. `items-start` on the grid keeps it from stretching, which
            is what makes the sticky offset behave. */}
        <aside className="surface space-y-5 p-5 lg:sticky lg:top-4 lg:z-10 lg:self-start">
          <div>
            <h2 className="text-base font-semibold text-navy">Filter by Skills:</h2>
            <p className="mt-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Select up to {MAX_SKILLS} skills</p>
          </div>
          <div>
            <Label htmlFor="browse-jobs-skills" className="sr-only">Skills</Label>
            <TagInput id="browse-jobs-skills" value={skillsDraft} onChange={setSkillsDraft} max={MAX_SKILLS} placeholder="Search for skills" />
          </div>
          <div>
            <Label htmlFor="browse-jobs-employment" className="block text-xs font-medium text-muted-foreground mb-1.5">Employment Type:</Label>
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
          <Button
            type="button"
            onClick={refine}
            className="w-full min-h-[44px] rounded-xl bg-navy text-white text-sm font-semibold hover:bg-primary transition-colors cursor-pointer"
          >
            Refine Search Results
          </Button>
        </aside>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-dark-blue">Displaying {jobs.length} out of {total} jobs:</h2>

          {loading ? (
            <JobListSkeleton count={4} />
          ) : error ? (
            <InlineError message={error} />
          ) : jobs.length === 0 ? (
            <div className="rounded-lg border border-primary bg-card px-6 py-12 text-center">
              <SearchX className="mx-auto mb-3 w-8 h-8 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
              <p className="font-semibold text-foreground">No jobs match your search</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another keyword, location, or skill.</p>
              <Button
                type="button"
                onClick={clearFilters}
                className="mt-4 min-h-[44px] px-4 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => {
                const bullets = requirementLines(job.requirements);
                const company = titleCase(job.employers?.company_name) || "Verified employer";
                const href = jobHref(job.id);
                const warm = () => prefetchRoute(href);
                const saved = savedIds.includes(job.id);
                return (
                  <li key={job.id}>
                    <article className="surface relative p-5 transition-colors hover:border-primary/30">
                      <div className="flex items-start gap-3">
                        <CompanyMark initials={String(company).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-muted-foreground">{company}</p>
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-teal"><Check className="size-3" />Verified employer</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{formatPosted(job.created_at)}</span>
                          {canSave && (
                            <button
                              type="button"
                              aria-label={saved ? `Unsave ${titleCase(job.title)}` : `Save ${titleCase(job.title)}`}
                              aria-pressed={saved}
                              onClick={() => setSavedIds(toggleSavedJob(job.id))}
                              className="relative z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                            >
                              {saved ? <BookmarkCheck className="size-4 fill-primary text-primary" /> : <Bookmark className="size-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                      <h3 className="mt-4 text-[17px] font-semibold leading-6 tracking-[-.025em]">
                        <Link to={href} onMouseEnter={warm} onFocus={warm} className="transition-colors hover:text-primary after:absolute after:inset-0 after:content-['']">{titleCase(job.title)}</Link>
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{titleCase(job.location)}</span>
                        <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3" />{job.employment_type}</span>
                      </div>
                      <p className="mt-4 text-[15px] font-semibold text-navy">{salaryLabel(job)}</p>
                      {job.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{job.description}</p>}
                      {bullets.length > 0 && (
                        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                          {bullets.map((line) => <li key={line}>{line}</li>)}
                        </ul>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} align="center" />
    </div>
  );
}

export default BrowseJobs;

