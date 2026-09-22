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
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          CANDIDATE PIPELINE
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          Applicant Tracking
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Review credentials and update recruitment statuses for candidate applications
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Candidate Name</th>
                <th className="text-left py-3 px-4 font-medium">Position Applied For</th>
                <th className="text-left py-3 px-4 font-medium">Date Submitted</th>
                <th className="text-left py-3 px-4 font-medium">Review Status</th>
                <th className="text-right py-3 px-4 font-medium">Evaluation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applicants.map((applicant) => (
                <tr key={applicant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{applicant.seekerName}</td>
                  <td className="py-3.5 px-4 text-gray-600">{applicant.jobTitle}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{applicant.applied}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                        applicant.status === "Shortlisted"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : applicant.status === "Rejected"
                            ? "bg-danger/10 border-danger/20 text-danger"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      {applicant.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {applicant.status !== "Shortlisted" && (
                      <button
                        onClick={() => setStatus(applicant.id, "Shortlisted")}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Shortlist
                      </button>
                    )}
                    {applicant.status !== "Rejected" && (
                      <button
                        onClick={() => setStatus(applicant.id, "Rejected")}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors"
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
            <div className="py-12 text-center text-sm text-gray-400">
              No applicant submissions yet. Candidates applying to your listings will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Applicants;
