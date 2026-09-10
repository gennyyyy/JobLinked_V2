import { useState } from "react";
import { getJobs, deleteJob, getApplicationsByJob } from "../../utils/jobStore";

function JobPosts() {
  const [jobPosts, setJobPosts] = useState(getJobs());

  function handleRemove(id) {
    deleteJob(id);
    setJobPosts(getJobs());
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          CENTRAL BULLETIN
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          All Municipal Job Postings
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Monitor and manage active job listings from verified Santa Maria employers
        </p>
      </header>

      <div className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] font-mono text-[10px] tracking-widest text-white/40 uppercase">
                <th className="text-left py-3 px-4 font-medium">Job Title</th>
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Location</th>
                <th className="text-left py-3 px-4 font-medium">Applicants</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {jobPosts.map((post) => (
                <tr key={post.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 text-white font-medium">{post.title}</td>
                  <td className="py-3.5 px-4 text-white/60">{post.company}</td>
                  <td className="py-3.5 px-4 text-xs text-white/50">{post.location}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/70">
                      {getApplicationsByJob(post.id).length} applied
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                        post.status === "Open"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-white/[0.05] border-white/[0.1] text-white/40"
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleRemove(post.id)}
                      className="text-xs font-mono text-rose-400/80 hover:text-rose-300 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobPosts.length === 0 && (
            <div className="py-12 text-center text-sm text-white/40">
              No job posts yet. Employers can create job posts through their portal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobPosts;
