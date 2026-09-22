import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getJobs } from "../utils/jobStore";
import heroImage from "../assets/pic.jpg";
import TextBasedLogo from "../assets/TextBased Logo.png";

const featureCards = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    ),
    title: "Explore Jobs",
    desc: "Find local and trusted job opportunities.",
    color: "bg-primary",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: "For Employers",
    desc: "Post jobs and find the right talent.",
    color: "bg-accent",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Programs & Services",
    desc: "Access PESO programs and employment support.",
    color: "bg-danger",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: "Career Resources",
    desc: "Learn, grow, and prepare for your future.",
    color: "bg-primary",
  },
];

const stats = [
  { value: "1,000+", label: "Job Opportunities" },
  { value: "500+", label: "Employers" },
  { value: "10,000+", label: "Job Seekers" },
  { value: "1", label: "Stronger Santa Maria" },
];

function Landing() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Santa Maria, Bulacan");
  const [activeTab, setActiveTab] = useState("seeker");

  function handleQuickSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (keyword.trim()) p.set("keyword", keyword.trim());
    if (location !== "All Locations") p.set("location", location);
    navigate(`/jobs?${p.toString()}`);
  }

  const locations = ["All Locations", ...new Set(getJobs().map((j) => j.location).filter(Boolean))];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2">
              <img src={TextBasedLogo} alt="JobLinked" className="h-10" />
              <div className="leading-none">
                <span className="text-lg font-extrabold tracking-tight text-dark-blue">JOB</span>
                <span className="text-lg font-extrabold tracking-tight text-primary">LINKED</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/portals" className="min-h-[40px] inline-flex items-center px-5 rounded-lg border-2 border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors">Login</Link>
            <Link to="/register" className="min-h-[40px] inline-flex items-center px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-md">Sign Up</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-[1280px] mx-auto px-6 pt-12 md:pt-20 pb-16 md:pb-24 grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div className="relative z-10">
            <p className="font-mono text-[11px] tracking-[0.25em] text-primary font-semibold uppercase">Santa Maria, Bulacan</p>
            <h1 className="mt-4 font-sans text-[44px] md:text-[68px] font-black leading-[0.92] tracking-[-0.03em] text-dark-blue">
              LOCAL JOBS.<br />
              <span className="text-accent relative">
                BRIGHTER
                <svg className="absolute -bottom-1 left-0 w-full h-3" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8c30-6 60-6 90-2s60 4 106-2" stroke="#FFC72C" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </span><br />
              TOMORROWS.
            </h1>
            <p className="mt-6 max-w-[42ch] text-[16px] leading-[1.7] text-gray-500">
              JobLinked connects job seekers and employers in Santa Maria. Discover opportunities, build your future, and be part of a stronger community.
            </p>

            {/* Tabs */}
            <div className="mt-8 flex gap-1 border-b border-gray-200">
              <button onClick={() => setActiveTab("seeker")} className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${activeTab === "seeker" ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600"}`}>Find a Job</button>
              <button onClick={() => setActiveTab("employer")} className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${activeTab === "employer" ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600"}`}>For Employers</button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleQuickSearch} className="mt-6 flex flex-col sm:flex-row gap-3 bg-white rounded-2xl p-3 shadow-lg border border-gray-200">
              <div className="flex items-center gap-2 flex-1 px-3">
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input id="q" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Job title, skills, or company" className="flex-1 min-h-[44px] text-sm bg-transparent border-none text-gray-900 placeholder:text-gray-400 focus:outline-none" />
              </div>
              <div className="flex items-center gap-2 px-3 border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0">
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <select id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="min-h-[44px] text-sm bg-transparent border-none text-gray-700 focus:outline-none cursor-pointer">
                  {locations.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <button type="submit" className="min-h-[44px] px-8 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2">
                Search Jobs
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>
          </div>

          {/* Hero Image */}
          <div className="relative hidden md:block">
            <div className="absolute -top-10 -right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
            <img src={heroImage} alt="Job seekers in Santa Maria" className="relative w-full aspect-[4/3] object-cover rounded-3xl shadow-2xl" />
            {/* Floating quote card */}
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-5 shadow-xl border border-gray-100 max-w-[220px]">
              <svg className="w-6 h-6 text-accent mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/>
              </svg>
              <p className="text-sm font-bold text-dark-blue leading-snug">More Opportunities. Stronger Communities.</p>
            </div>
          </div>
        </div>

        {/* Diagonal accent stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-r from-primary via-accent to-danger opacity-10 -skew-y-2 transform origin-bottom-left" />
      </section>

      {/* Feature Cards */}
      <section className="max-w-[1280px] mx-auto px-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {featureCards.map((card, i) => (
            <div key={card.title} style={{ animationDelay: `${i * 80}ms` }} className="animate-fade-in bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
              <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <h3 className="text-sm font-bold text-dark-blue">{card.title}</h3>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{card.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-primary text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-[1280px] mx-auto px-6 pt-16 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center md:text-left">
              <p className="font-sans text-4xl md:text-5xl font-black text-dark-blue leading-none">{stat.value}</p>
              <p className="mt-2 font-mono text-[11px] tracking-widest text-gray-400 uppercase">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Diagonal Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary to-accent" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMCAyMDBoMjAwVjBIMHYyMDB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        </div>
        <div className="relative max-w-[1280px] mx-auto px-6 py-16 md:py-20 text-center">
          <p className="text-white/80 text-sm font-medium mb-2">Connecting People.</p>
          <h2 className="font-sans text-3xl md:text-4xl font-black text-white leading-tight">
            Building a Brighter Santa Maria<br />for a Better Tomorrow.
          </h2>
        </div>
        {/* Yellow accent bar at bottom */}
        <div className="h-2 bg-accent" />
      </section>

      {/* Footer */}
      <footer className="bg-dark-blue text-white">
        <div className="max-w-[1280px] mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 text-sm text-white/70">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                Santa Maria, Bulacan
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                PESO Santa Maria
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                www.joblinked.gov.ph
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-[0.3em] text-white/50">
              <span className="text-accent font-bold">PEOPLE</span>
              <span>•</span>
              <span className="text-accent font-bold">OPPORTUNITIES</span>
              <span>•</span>
              <span className="text-accent font-bold">PROGRESS</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
