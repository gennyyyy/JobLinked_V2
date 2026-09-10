import { useState } from "react";
import { Link } from "react-router-dom";
import { getJobs } from "../../utils/jobStore";

function Jobs() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All Locations");

  const jobs = getJobs().filter((job) => job.status === "Open");
  const locations = ["All Locations", ...new Set(jobs.map((job) => job.location).filter(Boolean))];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = `${job.title} ${job.company}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesLocation = location === "All Locations" || job.location === location;
    return matchesSearch && matchesLocation;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          OPPORTUNITIES IN SANTA MARIA
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          Browse Verified Openings
        </h1>
        <p className="mt-2 text-sm text-white/55">
          {filteredJobs.length} active position{filteredJobs.length === 1 ? "" : "s"} available across 24 barangays
        </p>
      </header>

      {/* Search and Filters Form */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-[#272727] border border-white/[0.08] rounded-2xl p-3 flex flex-col sm:flex-row gap-3 shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
      >
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by job title or company..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
        />
        <select
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
        >
          {locations.map((loc) => (
            <option key={loc} value={loc} className="bg-[#272727] text-white">
              {loc}
            </option>
          ))}
        </select>
      </form>

      {/* Job Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredJobs.map((job) => (
          <Link
            key={job.id}
            to={`/job-seeker/jobs/${job.id}`}
            className="group bg-[#272727] border border-white/[0.06] rounded-2xl p-6 hover:border-[#0075A2]/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">
                  {job.location} · {job.type}
                </span>
                <span className="text-white/20 group-hover:text-[#0075A2] transition-colors text-sm">
                  ↗
                </span>
              </div>

              <h2 className="mt-2 text-lg font-semibold text-white group-hover:text-[#0075A2] transition-colors line-clamp-1">
                {job.title}
              </h2>
              <p className="text-xs text-white/50 mt-1">{job.company}</p>

              {job.description && (
                <p className="mt-3 text-xs text-white/55 line-clamp-2 leading-relaxed">
                  {job.description}
                </p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="inline-flex px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-[#0075A2] font-medium">
                {job.salary || "Negotiable"}
              </span>
              <span className="text-xs text-white/40 group-hover:text-white transition-colors">
                Apply now →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="py-16 text-center bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <p className="text-sm text-white/50">No openings match your search filters.</p>
          <button
            onClick={() => {
              setSearch("");
              setLocation("All Locations");
            }}
            className="mt-4 text-xs font-mono text-[#0075A2] hover:underline"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}

export default Jobs;
