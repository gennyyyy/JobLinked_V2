import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Handshake, GraduationCap, Search, ArrowRight } from "lucide-react";
import teamImage from "../../assets/team.png";
import landingBg from "../../assets/landing_page_bg.png";
import lpSample from "../../assets/lp_page_sample.png";
import SkipLink from "../../shared/components/SkipLink";
import PublicHeader from "../../shared/components/PublicHeader";
import PublicFooter from "../../shared/components/PublicFooter";

const featureCards = [
  {
    icon: <Briefcase className="w-10 h-10 shrink-0" />,
    title: "Explore Jobs",
    desc: "Find local and trusted job opportunities.",
    color: "bg-primary",
    textColor: "text-white",
  },
  {
    icon: <Handshake className="w-10 h-10 shrink-0" />,
    title: "Employer",
    desc: "Post jobs and find the right talent.",
    color: "bg-accent",
    textColor: "text-gray-900",
  },
  {
    icon: <GraduationCap className="w-10 h-10 shrink-0" />,
    title: "Program & Services",
    desc: "Access PESO programs and employment support.",
    color: "bg-danger",
    textColor: "text-white",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("seeker");

  function handleQuickSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (keyword.trim()) p.set("keyword", keyword.trim());
    navigate(`/jobs?${p.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#dbeafe] text-gray-900 font-sans">
      <SkipLink />

      <PublicHeader />

      <main id="main-content" tabIndex={-1}>
        {/* Hero Section */}
        <section className="relative overflow-hidden shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)]" style={{ backgroundImage: `url(${landingBg})`, backgroundSize: 'cover', backgroundPosition: 'left center' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/80" />

          <div className="relative w-full px-[95px] pt-12 md:pt-20 pb-32 md:pb-40">
            {/* Left content */}
            <div className="md:w-1/2">
              <h1 className="text-5xl md:text-[64px] font-black leading-[1.05] tracking-tight text-primary">
                LOCAL JOBS.
                <br />
                <span className="text-accent">BRIGHTER</span>
                <br />
                <span className="text-danger">TOMORROWS.</span>
              </h1>
              <p className="mt-3 text-sm md:text-base text-gray-800 max-w-xl whitespace-nowrap">Discover local government jobs and build your community with <span className="font-bold text-primary">JobLinked</span>.</p>

              {/* Tabs */}
              <div className="mt-8 flex gap-1 border-b border-gray-300 max-w-xl">
                <button
                  onClick={() => setActiveTab("seeker")}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-[3px] -mb-px transition-colors ${activeTab === "seeker"
                    ? "text-primary border-primary"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                    }`}
                >
                  Find a Job
                </button>
                <button
                  onClick={() => setActiveTab("employer")}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-[3px] -mb-px transition-colors ${activeTab === "employer"
                    ? "text-primary border-primary"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                    }`}
                >
                  For Employers
                </button>
              </div>

              {/* Search bar */}
              <form
                onSubmit={handleQuickSearch}
                className="mt-6 bg-white rounded-xl shadow-lg p-2 flex flex-col sm:flex-row gap-2 max-w-xl"
              >
                <div className="flex items-center gap-2 flex-1 px-3">
                  <Search className="w-5 h-5 text-gray-400 shrink-0" />
                  <input
                    id="q"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Job Title, skills, or company"
                    className="flex-1 min-h-[48px] text-sm bg-transparent border-none text-gray-900 italic placeholder:italic placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[48px] px-6 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Search Jobs
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            <img
              src={teamImage}
              alt="Job seekers in Santa Maria"
              className="hidden md:block absolute right-[5%] bottom-0 h-[85%] object-contain pointer-events-none"
            />
          </div>
        </section>

        {/* Feature Cards */}
        <section className="relative z-10 w-full px-[42px] mt-8 md:mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className={`${card.color} rounded-sm p-9 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] flex items-center gap-4 min-h-[138px]`}
              >
                <span className={card.textColor}>{card.icon}</span>
                <div className="min-w-0">
                  <h2 className={`text-2xl font-extrabold leading-tight ${card.textColor}`}>
                    {card.title}
                  </h2>
                  <p className={`mt-1 text-lg italic leading-snug ${card.textColor}`}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section className="w-full px-4 py-32 md:py-52">
          <div className="max-w-screen-xl mx-auto grid md:grid-cols-[3fr_2fr] gap-40 items-center">
            {/* Left - text container */}
            <div className="min-h-[70vh] flex items-center">
              <div>
                <p className="text-lg font-semibold uppercase tracking-widest text-gray-500">
                  About JobLinked
                </p>
                <h2 className="mt-6 text-6xl md:text-7xl font-black text-gray-900 leading-tight">
                  More Than Just a
                  <br />
                  <span className="text-danger">Job-Matching Platform</span>
                </h2>
                <p className="mt-8 text-2xl font-bold text-gray-900">
                  Connecting Local Talent, Employers, and Opportunities.
                </p>
                <p className="mt-8 text-xl text-gray-600 leading-relaxed">
                  Finding a job shouldn't be complicated, and hiring the right people shouldn't take
                  unnecessary time.
                </p>
                <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                  JobLinked connects local job seekers, verified employers, and the Public Employment
                  Service Office (PESO) through one centralized platform, making job searching and
                  recruitment easier.
                </p>
                <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                  More than just a job portal, JobLinked provides accessible opportunities, application
                  tracking, and efficient hiring management to create a faster, simpler, and more
                  transparent employment experience.
                </p>
              </div>
            </div>
            {/* Right - sample image in its own container */}
            <div className="flex items-center justify-center">
              <img
                src={lpSample}
                alt="JobLinked Dashboard Sample"
                className="w-full scale-150"
              />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default Landing;
