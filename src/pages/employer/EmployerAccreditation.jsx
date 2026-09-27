import { useState, useEffect } from "react";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { listAccreditations, listCompanyDocuments, uploadDocument, validateFile, signedUrl } from "../../services/documents";
import { DOC_TYPES } from "../../constants";
import LoadingScreen from "../../components/LoadingScreen";

function EmployerAccreditation() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [company, setCompany] = useState(null);
  const [accreditations, setAccreditations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle()
      .then(({ data, error: err }) => {
        if (err) throw err;
        setCompany(data);
        if (data) {
          return Promise.all([listAccreditations(data.id), listCompanyDocuments(data.id)]);
        }
        return [[], []];
      })
      .then(([accs, docs]) => {
        setAccreditations(accs);
        setDocuments(docs);
      })
      .catch((err) => setError(err.message || "Failed to load accreditation"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const latest = accreditations[0] || null;
  const status = latest?.status || "none";

  const uploadedCount = DOC_TYPES.filter((doc) => documents.some((d) => d.doc_type === doc && d.status !== "missing")).length;

  function handleFileChange(docType, e) {
    const file = e.target.files[0];
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }
    setFiles((prev) => ({ ...prev, [docType]: file }));
  }

  async function handleUpload(docType) {
    const file = files[docType];
    if (!file || !company) return;
    setUploading(docType);
    try {
      await uploadDocument(user.id, docType, file, company.id, latest?.id);
      const docs = await listCompanyDocuments(company.id);
      setDocuments(docs);
      setFiles((prev) => ({ ...prev, [docType]: null }));
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading("");
    }
  }

  async function handleView(doc) {
    try {
      const url = await signedUrl("documents", doc.file_path);
      window.open(url, "_blank");
    } catch (err) {
      setError(err.message);
    }
  }

  const statusBanner = {
    none: null,
    pending: { text: "Your application is under review by PESO.", className: "bg-amber-50 border-amber-200 text-amber-700" },
    approved: { text: "Your accreditation has been approved. You can now post job vacancies.", className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    rejected: { text: `Your accreditation was rejected. ${latest?.remarks || "Please review and resubmit."}`, className: "bg-danger/10 border-danger/20 text-danger" },
    resubmission: { text: `Additional documents required. ${latest?.remarks || ""}`, className: "bg-amber-50 border-amber-200 text-amber-700" },
  }[status];

  return (
    <div className="max-w-3xl animate-fade-in space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">EMPLOYER ACCREDITATION</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Accreditation Application</h1>
        <p className="mt-2 text-sm text-gray-500">Submit required documents for PESO verification and accreditation</p>
      </header>

      {statusBanner && (
        <div className={`p-4 rounded-xl border text-sm font-medium ${statusBanner.className}`}>
          {statusBanner.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-sm">
        <div className="flex items-center justify-between pb-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Required Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">{uploadedCount} of {DOC_TYPES.length} uploaded</p>
          </div>
          <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(uploadedCount / DOC_TYPES.length) * 100}%` }} />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {DOC_TYPES.map((docType) => {
            const doc = documents.find((d) => d.doc_type === docType);
            return (
              <div key={docType} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{docType}</p>
                  {doc ? (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{doc.file_name} · {doc.status}</p>
                  ) : (
                    <p className="text-xs text-gray-300 mt-0.5">Not uploaded</p>
                  )}
                </div>
                <div className="shrink-0 ml-4 flex gap-2">
                  {doc && (
                    <button onClick={() => handleView(doc)} className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors">
                      View
                    </button>
                  )}
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(docType, e)} className="hidden" id={`doc-${docType}`} />
                  <label htmlFor={`doc-${docType}`} className="cursor-pointer inline-block px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors">
                    {doc ? "Replace" : "Upload"}
                  </label>
                  {files[docType] && (
                    <button
                      onClick={() => handleUpload(docType)}
                      disabled={uploading === docType}
                      className="px-3 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-60"
                    >
                      {uploading === docType ? "…" : "Save"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EmployerAccreditation;
