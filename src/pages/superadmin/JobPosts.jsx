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
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          CENTRAL BULLETIN
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          All Municipal Job Postings
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Monitor and manage active job listings from verified Santa Maria employers
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Job Title</th>
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Location</th>
                <th className="text-left py-3 px-4 font-medium">Applicants</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobPosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{post.title}</td>
                  <td className="py-3.5 px-4 text-gray-500">{post.company}</td>
                  <td className="py-3.5 px-4 text-xs text-gray-500">{post.location}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                      {getApplicationsByJob(post.id).length} applied
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                        post.status === "Open"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-gray-50 border-gray-200 text-gray-400"
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleRemove(post.id)}
                      className="text-xs font-mono text-danger hover:text-danger transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobPosts.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              No job posts yet. Employers can create job posts through their portal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobPosts;
