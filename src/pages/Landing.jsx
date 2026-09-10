import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getJobs } from "../utils/jobStore";
import heroImage from "../assets/pic.jpg";

const steps = [
  { n: "01", t: "Create account", d: "Barangay-verified form." },
  { n: "02", t: "Find jobs", d: "Filter by type & place." },
  { n: "03", t: "Apply", d: "Tap to apply, no walk-in." },
  { n: "04", t: "Track", d: "Live PESO review." },
];

function Landing() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("All Locations");

  function handleQuickSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (keyword.trim()) p.set("keyword", keyword.trim());
    if (location !== "All Locations") p.set("location", location);
    navigate(`/jobs?${p.toString()}`);
  }

  const jobs = getJobs().filter((j) => j.status === "Open").slice(0, 6);
  const locations = ["All Locations", ...new Set(getJobs().map((j) => j.location).filter(Boolean))];

  return (
    <div className="min-h-screen bg-[#272727] text-slate-100 font-sans">
      <header className="sticky top-0 z-20 bg-[#272727]/80 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-white">Job<span className="text-[#0075A2]">Linked</span></Link>
          <span className="hidden sm:block font-mono text-[11px] text-white/30">PESO · SANTA MARIA</span>
        </div>
      </header>

      <section className="max-w-[1280px] mx-auto px-6 pt-10 md:pt-16 pb-0 grid md:grid-cols-[1.15fr_0.85fr] gap-8 md:gap-12 items-end">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2]">PUBLIC EMPLOYMENT SERVICE OFFICE</p>
          <h1 className="mt-4 font-sans text-[40px] md:text-[64px] font-bold leading-[0.88] tracking-[-0.03em] text-white">
            Find the<br /><span className="text-[#0075A2]">right job</span><br />in<br />Santa Maria
          </h1>
          <p className="mt-6 max-w-[40ch] text-[16px] md:text-[17px] leading-[1.6] text-white/55">
            Verified postings, barangay filters, and live PESO tracking — one bulletin for the municipality. No fees. No walk-ins.
          </p>
          <div className="mt-7 flex gap-3">
            <Link to="/jobs" className="min-h-[44px] inline-flex items-center px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all">Browse postings</Link>
            <Link to="/portals" className="min-h-[44px] inline-flex items-center px-6 rounded-xl border border-white/[0.12] text-sm text-white/70 hover:text-white hover:border-white/25 active:scale-[0.98] transition-all">Login</Link>
          </div>
        </div>
        <div className="relative">
          <img src={heroImage} alt="PESO office assistance" className="w-full aspect-[4/3] object-cover rounded-[1.5rem] border border-white/[0.08] bg-slate-900 shadow-[0_24px_64px_rgba(0,0,0,0.5)]" />
        </div>
      </section>


      <section className="max-w-[1280px] mx-auto px-6 relative z-10 mt-8 md:mt-10">
        <form onSubmit={handleQuickSearch} className="bg-[#272727] border border-white/[0.08] rounded-2xl p-3 flex flex-col sm:flex-row gap-3 shadow-[0_16px_48px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <label htmlFor="q" className="sr-only">Job title</label>
          <input id="q" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Job title or employer" className="flex-1 min-h-[44px] px-4 rounded-xl text-[16px] md:text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/50" />
          <label htmlFor="loc" className="sr-only">Location</label>
          <select id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="min-h-[44px] px-4 rounded-xl text-[16px] md:text-sm bg-[#272727] border border-white/[0.08] text-white focus:outline-none">
            {locations.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button type="submit" className="min-h-[44px] px-7 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-transform">Search</button>
        </form>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 pt-14 pb-10">
        <div className="flex items-baseline gap-4">
          <div className="hidden md:block h-px flex-1 bg-white/[0.06]" />
          <span className="font-mono text-[11px] tracking-widest text-white/25">MUNICIPAL DATA</span>
          <div className="hidden md:block h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div>
            <p className="font-sans text-3xl md:text-4xl font-bold text-white leading-none">24</p>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-white/30">BARANGAYS COVERED</p>
          </div>
          <div>
            <p className="font-sans text-3xl md:text-4xl font-bold text-white leading-none">100<span className="text-[#0075A2]">%</span></p>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-white/30">VERIFIED POSTINGS</p>
          </div>
          <div>
            <p className="font-sans text-3xl md:text-4xl font-bold text-white leading-none">Live</p>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-white/30">TRACKING ACTIVE</p>
            <span className="inline-block mt-2 w-2 h-2 rounded-full bg-[#0075A2] animate-pulse" />
          </div>
          <div>
            <p className="font-sans text-3xl md:text-4xl font-bold text-white leading-none">0</p>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-white/30">FEES CHARGED</p>
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 pb-10">
        <div className="flex items-baseline gap-4">
          <h2 className="font-sans text-2xl font-semibold text-white">How it works</h2>
          <div className="hidden md:block h-px flex-1 bg-white/[0.06]" />
          <span className="font-mono text-[11px] tracking-widest text-white/25">4 steps</span>
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={s.n} style={{ animationDelay: `${i * 80}ms` }} className="animate-fade-in bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors">
              <p className="font-mono text-[11px] tracking-widest text-[#0075A2]">{s.n}</p>
              <p className="mt-3 text-sm font-medium text-white">{s.t}</p>
              <p className="mt-1 text-xs text-white/45 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 pb-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-sans text-2xl font-semibold text-white">Featured postings</h2>
          <Link to="/jobs" className="hidden md:block text-xs text-white/40 hover:text-white underline underline-offset-4 decoration-white/15">View all →</Link>
        </div>
        <div className="mt-6 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {jobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`} className="snap-start shrink-0 w-[280px] md:w-[340px] group bg-[#272727] border border-white/[0.06] rounded-2xl p-6 hover:border-[#0075A2]/30 hover:-translate-y-0.5 transition-all">
              <p className="font-mono text-[10px] tracking-widest text-white/35 truncate">{job.location} · {job.type}</p>
              <h3 className="mt-2 text-[15px] font-medium text-white group-hover:text-[#0075A2] transition-colors line-clamp-2 leading-tight">{job.title}</h3>
              <p className="text-xs text-white/40 truncate">{job.company}</p>
              <p className="mt-4 inline-flex px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-white/60">{job.salary || "—"}</p>
            </Link>
          ))}
        </div>
        <Link to="/jobs" className="md:hidden mt-2 inline-block text-xs text-white/40 hover:text-white underline underline-offset-4">View all →</Link>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 pb-8 grid md:grid-cols-2 gap-5">
        <div className="bg-[#272727] border border-white/[0.06] rounded-[1.25rem] p-7">
          <h3 className="font-sans text-lg font-semibold text-white">For Job Seekers</h3>
          <p className="mt-2 text-sm text-white/50">Verified postings and live PESO tracking — no municipal trip required.</p>
          <Link to="/jobs" className="inline-flex mt-4 text-xs font-medium text-[#0075A2] border-b border-[#0075A2]/40 pb-1 hover:border-[#0075A2] transition-colors">Find a job —</Link>
        </div>
        <div className="bg-[#0075A2] rounded-[1.25rem] p-7 text-white">
          <h3 className="font-sans text-lg font-semibold">For Employers</h3>
          <p className="mt-2 text-sm text-white/80">Post openings and manage applicants in one place.</p>
          <Link to="/portals" className="inline-flex mt-4 text-xs font-medium border-b border-white/50 pb-1 hover:border-white/80 transition-colors">Post a job —</Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-[#060608] text-white/30">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">Job<span className="text-[#0075A2]">Linked</span> <span className="text-white/40">PESO</span></span>
          <span>Municipal Hall, Poblacion · hello@joblinked.ph</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
