import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  getApplicationsByEmployer,
  updateApplicationStatus,
} from "../../utils/jobStore";

function Applicants() {
  const { user } = useAuth();
  const companyEmail = user?.email || "";
  const [applicants, setApplicants] = useState(getApplicationsByEmployer(companyEmail));

  function setStatus(id, status) {
    updateApplicationStatus(id, status);
    setApplicants(getApplicationsByEmployer(companyEmail));
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          CANDIDATE PIPELINE
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          Applicant Tracking
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Review credentials and update recruitment statuses for candidate applications
        </p>
      </header>

      <div className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] font-mono text-[10px] tracking-widest text-white/40 uppercase">
                <th className="text-left py-3 px-4 font-medium">Candidate Name</th>
                <th className="text-left py-3 px-4 font-medium">Position Applied For</th>
                <th className="text-left py-3 px-4 font-medium">Date Submitted</th>
                <th className="text-left py-3 px-4 font-medium">Review Status</th>
                <th className="text-right py-3 px-4 font-medium">Evaluation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {applicants.map((applicant) => (
                <tr key={applicant.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 text-white font-medium">{applicant.seekerName}</td>
                  <td className="py-3.5 px-4 text-white/70">{applicant.jobTitle}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-white/50">{applicant.applied}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                        applicant.status === "Shortlisted"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : applicant.status === "Rejected"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {applicant.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {applicant.status !== "Shortlisted" && (
                      <button
                        onClick={() => setStatus(applicant.id, "Shortlisted")}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        Shortlist
                      </button>
                    )}
                    {applicant.status !== "Rejected" && (
                      <button
                        onClick={() => setStatus(applicant.id, "Rejected")}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors"
                      >
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {applicants.length === 0 && (
            <div className="py-12 text-center text-sm text-white/40">
              No applicant submissions yet. Candidates applying to your listings will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Applicants;
