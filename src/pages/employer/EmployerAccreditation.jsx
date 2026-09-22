import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import { findApplicationByEmail, addApplication } from "../../utils/employerStore";

const REQUIRED_DOCUMENTS = [
  { key: "letterOfIntent", label: "Letter of Intent" },
  { key: "companyProfile", label: "Company Profile" },
  { key: "businessPermit", label: "Business Permit" },
  { key: "dti", label: "DTI Registration" },
  { key: "jobOrders", label: "Job Orders" },
  { key: "philJobNet", label: "PhilJobNet Registration" },
  { key: "pagIbig", label: "Pag-IBIG Certificate" },
  { key: "philHealth", label: "PhilHealth Certificate" },
  { key: "fireSafety", label: "Fire Safety Certificate" },
];

function EmployerAccreditation() {
  const { user } = useAuth();
  const email = user?.email || "";
  const existing = findApplicationByEmail(email);

  const [documents, setDocuments] = useState(() => {
    const saved = existing?.documents || {};
    return REQUIRED_DOCUMENTS.reduce((acc, doc) => {
      acc[doc.key] = saved[doc.key] || null;
      return acc;
    }, {});
  });
  const [submitted, setSubmitted] = useState(!!existing);
  const [status, setStatus] = useState(existing?.status || null);

  if (!email) {
    return <div className="text-center py-16 text-gray-400">You must be logged in.</div>;
  }

  function handleFileChange(key, e) {
    const file = e.target.files[0];
    if (!file) return;
    setDocuments((prev) => ({
      ...prev,
      [key]: { name: file.name, size: (file.size / 1024).toFixed(1) + " KB" },
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const allUploaded = REQUIRED_DOCUMENTS.every((doc) => documents[doc.key]);
    if (!allUploaded) {
      alert("Please upload all required documents before submitting.");
      return;
    }
    addApplication({
      companyEmail: email,
      companyName: user?.name || "Company",
      documents,
    });
    setSubmitted(true);
    setStatus("Pending");
  }

  const uploadedCount = REQUIRED_DOCUMENTS.filter((doc) => documents[doc.key]).length;

  return (
    <div className="max-w-3xl animate-fade-in space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          EMPLOYER ACCREDITATION
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          Accreditation Application
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Submit required documents for PESO verification and accreditation
        </p>
      </header>

      {status && (
        <div className={`p-4 rounded-xl border text-sm font-medium ${
          status === "Approved"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : status === "Rejected"
            ? "bg-danger/10 border-danger/20 text-danger"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          {status === "Approved" && "Your accreditation has been approved. You can now post job vacancies."}
          {status === "Rejected" && `Your accreditation was rejected. ${existing?.note ? `Reason: ${existing.note}` : "Please review and resubmit."}`}
          {status === "Pending" && "Your application is under review by PESO. You will be notified once a decision is made."}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-sm">
        <div className="flex items-center justify-between pb-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Required Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {uploadedCount} of {REQUIRED_DOCUMENTS.length} uploaded
            </p>
          </div>
          <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(uploadedCount / REQUIRED_DOCUMENTS.length) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <div key={doc.key} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                {documents[doc.key] ? (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{documents[doc.key].name} ({documents[doc.key].size})</p>
                ) : (
                  <p className="text-xs text-gray-300 mt-0.5">Not uploaded</p>
                )}
              </div>
              <div className="shrink-0 ml-4">
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(doc.key, e)} className="hidden" id={`doc-${doc.key}`} />
                <label htmlFor={`doc-${doc.key}`} className="cursor-pointer inline-block px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors">
                  {documents[doc.key] ? "Replace" : "Upload"}
                </label>
              </div>
            </div>
          ))}

          {!submitted && (
            <div className="pt-4">
              <button type="submit" className="w-full min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-medium hover:bg-[#004a9e] transition-colors">
                Submit for Accreditation
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default EmployerAccreditation;
