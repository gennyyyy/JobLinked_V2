import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { listAllAccreditations, listCompanies, updateUser } from "../../shared/services/admin";
import { signedUrl, updateAccreditation, updateDocumentStatus, listCompanyDocuments, latestAccByCompany } from "../../shared/services/documents";
import LoadingScreen from "../../shared/components/LoadingScreen";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import { formatFullAddress } from "../../shared/utils/address";

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider text-gray-500 uppercase">{label}</p>
      <p className="mt-1 text-sm text-gray-900 font-medium">{value || "—"}</p>
    </div>
  );
}

function DetailModal({ accreditation, onClose }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accreditation) return;
    listCompanyDocuments(accreditation.company_id)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [accreditation]);

  async function handleViewDoc(doc) {
    try {
      const url = await signedUrl("documents", doc.file_path);
      window.open(url, "_blank");
    } catch {
      // ignore signed URL errors
    }
  }

  async function handleDocStatus(docId, status) {
    await updateDocumentStatus(docId, status);
    const updated = await listCompanyDocuments(accreditation.company_id);
    setDocs(updated);
  }

  if (!accreditation) return null;
  const company = accreditation.employers;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-primary rounded-2xl shadow-xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-[#0057B8] uppercase">APPLICATION DOCUMENTS</span>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{company?.company_name}</h2>
            <p className="mt-1 text-xs text-gray-500">
              Submitted {new Date(accreditation.submitted_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors" aria-label="Close">✕</button>
        </div>

        <section className="mt-6">
          <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-4">Company Information</h3>
          <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <InfoRow label="Company Name" value={company?.company_name} />
            <InfoRow label="Barangay" value={company?.barangay_district} />
            <InfoRow label="Business Address" value={formatFullAddress(company)} />
            <InfoRow label="Contact Number" value={company?.phone} />
            <InfoRow label="Industry" value={company?.industry} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-4">Accreditation Documents</h3>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            {loading ? (
              <p className="text-xs text-gray-400">Loading documents…</p>
            ) : docs.length === 0 ? (
              <p className="text-xs text-gray-400">No documents uploaded.</p>
            ) : (
              <ul className="space-y-3">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-200 last:border-0">
                    <div>
                      <p className="text-gray-700 font-medium">{doc.doc_type}</p>
                      <p className="text-gray-400">{doc.file_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full uppercase border ${doc.status === "verified" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : doc.status === "rejected" ? "bg-danger/10 border-danger/20 text-danger"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}>
                        {doc.status}
                      </span>
                      <button onClick={() => handleViewDoc(doc)} className="text-primary hover:underline">View</button>
                      <button onClick={() => handleDocStatus(doc.id, "verified")} className="text-emerald-600 hover:underline">Verify</button>
                      <button onClick={() => handleDocStatus(doc.id, "rejected")} className="text-danger hover:underline">Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Close Documents
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Accreditation() {
  const [accs, setAccs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    Promise.all([listAllAccreditations(), listCompanies()])
      .then(([allAccs, comps]) => {
        setAccs(allAccs);
        setCompanies(comps);
      })
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  // accs is ordered by submitted_at desc, so the first row per company is its latest
  const pending = accs.filter((a) => a.status === "pending");
  const latestByCompany = latestAccByCompany(accs);

  async function handleApprove(acc) {
    await updateAccreditation(acc.id, { status: "approved", remarks: "Account verified and accredited." });
    setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: "approved" } : a)));
    setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: "approved" } : c)));
  }

  async function startReject(acc) {
    setRejectingId(acc.id);
    setRejectNote("");
    setRejectError(false);
  }

  async function confirmReject(acc) {
    const note = rejectNote.trim();
    if (!note) { setRejectError(true); return; }
    await updateAccreditation(acc.id, { status: "rejected", remarks: note });
    setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: "rejected", remarks: note } : a)));
    setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: "rejected" } : c)));
    setRejectingId(null);
    setRejectNote("");
    setRejectError(false);
  }

  async function toggleCompanyStatus(company) {
    const newStatus = company.status === "suspended" ? "active" : "suspended";
    await updateUser(company.id, { status: newStatus });
    const updated = await listCompanies();
    setCompanies(updated);
  }

  async function confirmRevoke() {
    const acc = latestByCompany[revoking.id];
    const remarks = "Accreditation revoked by PESO.";
    await updateAccreditation(acc.id, { status: "revoked", remarks });
    setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: "revoked", remarks } : a)));
    setCompanies((prev) => prev.map((c) => (c.id === revoking.id ? { ...c, accreditation_status: "revoked" } : c)));
    setRevoking(null);
  }

  async function reinstate(acc) {
    const remarks = "Accreditation reinstated by PESO.";
    await updateAccreditation(acc.id, { status: "approved", remarks });
    setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: "approved", remarks } : a)));
    setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: "approved" } : c)));
  }

  const viewingAcc = viewingId ? pending.find((a) => a.id === viewingId) : null;

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">EMPLOYER DIRECTORY</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Accreditation Management</h1>
        <p className="mt-2 text-sm text-gray-500">Verify municipal employer applications and manage compliance statuses</p>
      </header>

      <section className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-l-4 border-primary pl-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-dark-blue">Pending Accreditation</h2>
            <span className="font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
              {pending.length} PENDING
            </span>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No employers currently waiting for accreditation verification.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((acc) => (
              <div key={acc.id} className="py-5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900">{acc.employers?.company_name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatFullAddress(acc.employers) || "Address not provided"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Submitted {new Date(acc.submitted_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  {rejectingId === acc.id ? (
                    <div className="flex flex-col gap-2 w-full sm:w-72">
                      <textarea
                        value={rejectNote}
                        onChange={(e) => { setRejectNote(e.target.value); setRejectError(false); }}
                        rows={2}
                        placeholder="Reason for rejection or required changes..."
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-danger/40 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none"
                      />
                      {rejectError && <p className="text-[11px] text-danger">Please enter a rejection reason.</p>}
                      <div className="flex gap-2">
                        <button onClick={() => confirmReject(acc)} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-danger text-white hover:bg-danger/90 transition-colors">Confirm Rejection</button>
                        <button onClick={() => setRejectingId(null)} className="px-3 py-1.5 text-xs rounded-lg text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewingId(acc.id)} className="px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">View Documents</button>
                      <button onClick={() => handleApprove(acc)} className="px-4 py-2 text-xs font-medium rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors shadow-[0_2px_8px_rgba(0,87,184,0.25)]">Accredit</button>
                      <button onClick={() => startReject(acc)} className="px-3.5 py-2 text-xs font-medium rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-colors">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-l-4 border-primary pl-4">
          <h2 className="text-lg font-semibold text-dark-blue">Registered Employers ({companies.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Owner</th>
                <th className="text-left py-3 px-4 font-medium">Email</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Accreditation</th>
                <th className="text-right py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-primary/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{company.company_name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{company.full_name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{company.email}</td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${company.status === "active" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : company.status === "suspended" ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-gray-100 border-gray-200 text-gray-500"
                      }`}>
                      {company.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      // Read directly from the employers row — kept in sync by documents.js
                      const status = company.accreditation_status || "not applied";
                      const styles = status === "approved"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : status === "pending"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : status === "rejected" || status === "revoked"
                            ? "bg-danger/10 border-danger/20 text-danger"
                            : "bg-gray-100 border-gray-200 text-gray-500";
                      return (
                        <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${styles}`}>
                          {status}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {latestByCompany[company.id]?.status === "approved" && (
                        <button
                          onClick={() => setRevoking(company)}
                          className="text-xs font-mono text-danger hover:text-danger/80 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                      {latestByCompany[company.id]?.status === "revoked" && (
                        <button
                          onClick={() => reinstate(latestByCompany[company.id])}
                          className="text-xs font-mono text-[#0057B8] hover:text-gray-900 transition-colors"
                        >
                          Reinstate
                        </button>
                      )}
                      <button
                        onClick={() => toggleCompanyStatus(company)}
                        className={`text-xs font-mono transition-colors ${company.status === "suspended" ? "text-[#0057B8] hover:text-gray-900" : "text-danger hover:text-danger"
                          }`}
                      >
                        {company.status === "suspended" ? "Activate" : "Suspend"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewingAcc && (
        <DetailModal
          accreditation={viewingAcc}
          onClose={() => setViewingId(null)}
        />
      )}

      {revoking && (
        <ConfirmationModal
          message={`Revoke accreditation for ${revoking.company_name}? They will no longer be able to post job vacancies until reinstated.`}
          confirmLabel="Revoke Accreditation"
          danger
          onConfirm={confirmRevoke}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  );
}

export default Accreditation;
