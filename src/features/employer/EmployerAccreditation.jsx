import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { getEmployer } from "../../shared/services/auth";
import { listAccreditations, createAccreditation, listCompanyDocuments, uploadDocument, validateFile, signedUrl } from "../../shared/services/documents";
import { DOC_TYPES } from "../../shared/constants";
import LoadingScreen from "../../shared/components/LoadingScreen";

function EmployerAccreditation() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [company, setCompany] = useState(null);
  const [accreditations, setAccreditations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState("documents");

  useEffect(() => {
    if (!user) return;
    getEmployer()
      .then(async (data) => {
        setCompany(data);
        if (data) {
          const [accs, docs] = await Promise.all([
            listAccreditations(data.id),
            listCompanyDocuments(data.id),
          ]);
          return [accs, docs];
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

  async function handleSubmitApplication() {
    if (!company) return;
    setSubmitting(true);
    setError("");
    try {
      const acc = await createAccreditation(company.id);
      setAccreditations([acc]);
      // Refresh auth context so accreditation_status is up-to-date everywhere
      if (refreshUser) await refreshUser(user);
    } catch (err) {
      setError(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

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
    revoked: { text: `Your accreditation has been revoked. ${latest?.remarks || "Contact PESO for details."}`, className: "bg-danger/10 border-danger/20 text-danger" },
    resubmission: { text: `Additional documents required. ${latest?.remarks || ""}`, className: "bg-amber-50 border-amber-200 text-amber-700" },
  }[status];

  // No application submitted yet — show a prompt to start the process explicitly
  if (status === "none") {
    return (
      <div className="w-full space-y-6">
        <header>
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">EMPLOYER ACCREDITATION</p>
          <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">Accreditation Application</h1>
          <p className="mt-2 text-sm text-muted-foreground">Submit required documents for PESO verification and accreditation</p>
        </header>

        <div className="bg-card border border-primary rounded-lg p-6 md:p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Start Your Accreditation</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            To post job vacancies, your company must be accredited by PESO. Begin by submitting your application and uploading the required documents.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            onClick={handleSubmitApplication}
            disabled={submitting}
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-md disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Begin Accreditation Application"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">EMPLOYER ACCREDITATION</p>
        <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">Accreditation Application</h1>
        <p className="mt-2 text-sm text-muted-foreground">Submit required documents for PESO verification and accreditation</p>
      </header>

      {statusBanner && (
        <div className={`p-4 rounded-xl border text-sm font-medium ${statusBanner.className}`}>
          {statusBanner.text}
        </div>
      )}

      <div className="bg-card border border-primary rounded-lg p-6 md:p-9">
        <div className="flex items-center gap-1 p-1 bg-muted border border-border rounded-xl w-fit mb-6">
          {[["documents", "Required Documents"], ["history", `History (${accreditations.length})`]].map(([key, label]) => (
            <Button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${tab === key ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </Button>
          ))}
        </div>

        {tab === "history" ? (
          <div className="space-y-3">
            {accreditations.length === 0 ? (
              <p className="text-xs text-muted-foreground">No accreditation history yet.</p>
            ) : (
              accreditations.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-muted border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize">{a.status}</p>
                    {a.remarks && <p className="text-xs text-muted-foreground mt-1">PESO remarks: {a.remarks}</p>}
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      Submitted {new Date(a.submitted_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                      {a.decided_at ? ` · Decided ${new Date(a.decided_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                    a.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : a.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-700"
                    : a.status === "rejected" || a.status === "revoked" ? "bg-danger/10 border-danger/20 text-danger"
                    : "bg-muted border-border text-muted-foreground"
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
        <>
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Required Documents</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{uploadedCount} of {DOC_TYPES.length} uploaded</p>
          </div>
          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(uploadedCount / DOC_TYPES.length) * 100}%` }} />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {DOC_TYPES.map((docType) => {
            const doc = documents.find((d) => d.doc_type === docType);
            return (
              <div key={docType} className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{docType}</p>
                  {doc ? (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.file_name} · {doc.status}</p>
                  ) : (
                    <p className="text-xs text-gray-300 mt-0.5">Not uploaded</p>
                  )}
                </div>
                <div className="shrink-0 ml-4 flex gap-2">
                  {doc && (
                    <Button onClick={() => handleView(doc)} className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-gray-200 border border-border rounded-lg transition-colors">
                      View
                    </Button>
                  )}
                  <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(docType, e)} className="hidden" id={`doc-${docType}`} />
                  <Label htmlFor={`doc-${docType}`} className="cursor-pointer inline-block px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-gray-200 border border-border rounded-lg transition-colors">
                    {doc ? "Replace" : "Upload"}
                  </Label>
                  {files[docType] && (
                    <Button
                      onClick={() => handleUpload(docType)}
                      disabled={uploading === docType}
                      className="px-3 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-60"
                    >
                      {uploading === docType ? "…" : "Save"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default EmployerAccreditation;
