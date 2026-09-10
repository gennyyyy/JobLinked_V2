import { useState } from "react";
import { getApplications, updateApplicationStatus } from "../../utils/employerStore";

const initialActive = [
  {
    id: 3,
    company: "Municipal Government of Santa Maria",
    representative: "Maria Santos",
    email: "maria.santos@santamaria.gov.ph",
    status: "Active",
  },
  {
    id: 4,
    company: "Santa Maria Water District",
    representative: "Jose Reyes",
    email: "jose.reyes@smwater.gov.ph",
    status: "Active",
  },
  {
    id: 5,
    company: "Santa Maria Doctors Hospital",
    representative: "Ana Lim",
    email: "ana.lim@smdh.gov.ph",
    status: "Suspended",
  },
];

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider text-white/40 uppercase">{label}</p>
      <p className="mt-1 text-sm text-white font-medium">{value || "—"}</p>
    </div>
  );
}

function DetailModal({ application, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#272727] w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/[0.1] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-[#0075A2] uppercase">
              APPLICATION DOSSIER
            </span>
            <h2 className="mt-1 text-xl font-bold text-white">{application.company}</h2>
            <p className="mt-1 text-xs text-white/45">
              Submitted {new Date(application.submittedAt).toLocaleString("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <section className="mt-6">
          <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
            Company Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <InfoRow label="Company Name" value={application.company} />
            <InfoRow label="Barangay" value={`Brgy. ${application.barangay}`} />
            <InfoRow
              label="Business Address"
              value={`${application.businessAddress}, Barangay ${application.barangay}`}
            />
            <InfoRow label="Contact Number" value={application.contactNumber} />
            <InfoRow label="Company Email" value={application.companyEmail} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
            Authorized Representative
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <InfoRow label="Full Name" value={application.repFullName} />
            <InfoRow label="Designation" value={application.repPosition} />
            <InfoRow label="Email" value={application.repEmail} />
            <InfoRow label="Mobile Number" value={application.repMobile} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
            Accreditation Documents
          </h3>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {Object.entries(application.documents).filter(([, name]) => name).length === 0 ? (
              <p className="text-xs text-white/40">No documents uploaded.</p>
            ) : (
              <ul className="space-y-2.5">
                {Object.entries(application.documents)
                  .filter(([, name]) => name)
                  .map(([key, name]) => (
                    <li key={key} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.04] last:border-0">
                      <span className="text-white/60 font-medium">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      <span className="font-mono text-white/40">{name}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <div className="mt-8 pt-5 border-t border-white/[0.06] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium rounded-xl border border-white/[0.12] text-white hover:bg-white/[0.05] transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

function Employers() {
  const [pending, setPending] = useState(
    () => getApplications().filter((application) => application.status === "Pending"),
  );
  const [active, setActive] = useState(initialActive);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState(false);
  const [viewingId, setViewingId] = useState(null);

  const viewingApplication = viewingId
    ? getApplications().find((application) => application.id === viewingId)
    : null;

  function toggleStatus(employer) {
    setActive((prev) =>
      prev.map((item) =>
        item.id === employer.id
          ? { ...item, status: item.status === "Active" ? "Suspended" : "Active" }
          : item,
      ),
    );
  }

  function handleApprove(application) {
    updateApplicationStatus(application.id, "Approved", "Account verified and accredited.");
    setPending((prev) => prev.filter((item) => item.id !== application.id));
  }

  function startReject(application) {
    setRejectingId(application.id);
    setRejectNote("");
    setRejectError(false);
  }

  function confirmReject(application) {
    const note = rejectNote.trim();
    if (!note) {
      setRejectError(true);
      return;
    }
    updateApplicationStatus(application.id, "Rejected", note);
    setPending((prev) => prev.filter((item) => item.id !== application.id));
    setRejectingId(null);
    setRejectNote("");
    setRejectError(false);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          EMPLOYER DIRECTORY
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          Accreditation Management
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Verify municipal employer applications and manage compliance statuses
        </p>
      </header>

      {/* Pending Applications Section */}
      <section className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-white">
              Pending Accreditation
            </h2>
            <span className="font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
              {pending.length} PENDING
            </span>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/40">
            No employers currently waiting for accreditation verification.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {pending.map((application) => (
              <div
                key={application.id}
                className="py-5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">
                    {application.company}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {application.repFullName} ({application.repPosition}) · {application.repEmail}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Barangay {application.barangay} · Submitted{" "}
                    {new Date(application.submittedAt).toLocaleDateString("en-PH", {
                      dateStyle: "medium",
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.values(application.documents)
                      .filter(Boolean)
                      .map((document) => (
                        <span
                          key={document}
                          className="font-mono px-2.5 py-0.5 rounded-full text-[10px] text-white/50 bg-white/[0.03] border border-white/[0.08]"
                        >
                          {document}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  {rejectingId === application.id ? (
                    <div className="flex flex-col gap-2 w-full sm:w-72">
                      <textarea
                        value={rejectNote}
                        onChange={(event) => {
                          setRejectNote(event.target.value);
                          setRejectError(false);
                        }}
                        rows={2}
                        placeholder="Reason for rejection or required changes..."
                        className="w-full px-3 py-2 text-xs bg-[#272727] border border-rose-500/40 rounded-xl text-white placeholder:text-white/25 focus:outline-none"
                      />
                      {rejectError && (
                        <p className="text-[11px] text-rose-400">
                          Please enter a rejection reason.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmReject(application)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="px-3 py-1.5 text-xs rounded-lg text-white/50 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingId(application.id)}
                        className="px-3.5 py-2 text-xs font-medium rounded-xl border border-white/[0.1] text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors"
                      >
                        View Files
                      </button>
                      <button
                        onClick={() => handleApprove(application)}
                        className="px-4 py-2 text-xs font-medium rounded-xl bg-[#0075A2] text-white hover:bg-[#005a7d] transition-colors shadow-[0_2px_8px_rgba(0,117,162,0.25)]"
                      >
                        Accredit
                      </button>
                      <button
                        onClick={() => startReject(application)}
                        className="px-3.5 py-2 text-xs font-medium rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Registered Active Employers Section */}
      <section className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            Registered Employers ({active.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] font-mono text-[10px] tracking-widest text-white/40 uppercase">
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Representative</th>
                <th className="text-left py-3 px-4 font-medium">Email</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {active.map((employer) => (
                <tr key={employer.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 text-white font-medium">{employer.company}</td>
                  <td className="py-3.5 px-4 text-white/60">{employer.representative}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-white/45">{employer.email}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                        employer.status === "Active"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {employer.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleStatus(employer)}
                      className={`text-xs font-mono transition-colors ${
                        employer.status === "Active"
                          ? "text-rose-400/80 hover:text-rose-300"
                          : "text-[#0075A2] hover:text-white"
                      }`}
                    >
                      {employer.status === "Active" ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewingApplication && (
        <DetailModal
          application={viewingApplication}
          onClose={() => setViewingId(null)}
        />
      )}
    </div>
  );
}

export default Employers;
