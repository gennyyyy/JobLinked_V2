import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState, useEffect } from "react";
import { ClipboardList, FileCheck2 } from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { getEmployer } from "../../shared/services/auth";
import { listAccreditations, createAccreditation, listCompanyDocuments, uploadDocument, validateFile, signedUrl } from "../../shared/services/documents";
import { DOC_TYPES } from "../../shared/constants";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { InlineError } from "../../shared/components/dashboard";
import { Notice, PageHeading, Panel, StatusBadge } from "../../shared/components/design";

// Accreditation rows store lowercase statuses; StatusBadge speaks the portal's
// review vocabulary, so map once and use it for the heading and the history.
const STATUS_LABELS = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Suspended",
  resubmission: "Resubmission Requested",
};
const statusLabel = (value = "") => STATUS_LABELS[value] || value.charAt(0).toUpperCase() + value.slice(1);

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
  if (error) return <InlineError message={error} />;

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
    pending: { title: "Application received", text: "Your application is under review by PESO.", warning: true },
    approved: { title: "Accreditation approved", text: "Your accreditation has been approved. You can now post job vacancies.", warning: false },
    rejected: { title: "Accreditation rejected", text: `Your accreditation was rejected. ${latest?.remarks || "Please review and resubmit."}`, warning: true },
    revoked: { title: "Accreditation revoked", text: `Your accreditation has been revoked. ${latest?.remarks || "Contact PESO for details."}`, warning: true },
    resubmission: { title: "Additional documents required", text: `Additional documents required. ${latest?.remarks || ""}`.trim(), warning: true },
  }[status];

  const heading = (
    <PageHeading
      eyebrow="Employer accreditation"
      title="Accreditation Application"
      description="Submit required documents for PESO verification and accreditation"
      action={latest ? <StatusBadge status={statusLabel(status)} /> : null}
    />
  );

  // No application submitted yet — show a prompt to start the process explicitly
  if (status === "none") {
    return (
      <>
        {heading}
        <div className="surface flex flex-col items-center gap-3 py-10 text-center">
          <span className="soft-icon size-14">
            <ClipboardList className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-navy">Start Your Accreditation</h2>
          <p className="max-w-sm text-xs leading-6 text-muted-foreground">
            To post job vacancies, your company must be accredited by PESO. Begin by submitting your application and uploading the required documents.
          </p>
          <Button onClick={handleSubmitApplication} disabled={submitting} className="mt-2 gap-2 px-5">
            {submitting ? "Submitting…" : "Begin Accreditation Application"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {heading}

      {statusBanner && (
        <div className="mb-6">
          <Notice title={statusBanner.title} warning={statusBanner.warning}>
            {statusBanner.text}
          </Notice>
        </div>
      )}

      <div className="mb-5 flex w-fit items-center gap-1 rounded-xl border bg-muted p-1">
        {[["documents", "Required Documents"], ["history", `History (${accreditations.length})`]].map(([key, label]) => (
          <Button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 text-xs font-medium ${tab === key ? "bg-primary text-white shadow-xs" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "history" ? (
        <Panel title="Accreditation history" description="A record of every review by PESO.">
          {accreditations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No accreditation history yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {accreditations.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                  <div className="min-w-0">
                    <StatusBadge status={statusLabel(a.status)} />
                    {a.remarks && <p className="mt-2 text-xs leading-6 text-muted-foreground">PESO remarks: {a.remarks}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Submitted {new Date(a.submitted_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                      {a.decided_at ? ` · Decided ${new Date(a.decided_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <Panel
          title="Required Documents"
          description={`${uploadedCount} of ${DOC_TYPES.length} uploaded`}
          action={
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(uploadedCount / DOC_TYPES.length) * 100}%` }} />
            </div>
          }
        >
          <ul className="flex flex-col gap-3">
            {DOC_TYPES.map((docType) => {
              const doc = documents.find((d) => d.doc_type === docType);
              return (
                <li key={docType} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileCheck2 className={`size-5 shrink-0 ${doc ? "text-teal" : "text-muted-foreground/40"}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-navy">{docType}</p>
                      <p className="mt-1 max-w-[240px] truncate text-[10px] text-muted-foreground">
                        {doc ? `${doc.file_name} · ${doc.status}` : "Not uploaded"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {doc && (
                      <Button variant="outline" onClick={() => handleView(doc)} className="text-xs">
                        View
                      </Button>
                    )}
                    <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(docType, e)} className="hidden" id={`doc-${docType}`} />
                    <Label htmlFor={`doc-${docType}`} className="inline-flex min-h-8 cursor-pointer items-center rounded-lg border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                      {doc ? "Replace" : "Upload"}
                    </Label>
                    {files[docType] && (
                      <Button
                        onClick={() => handleUpload(docType)}
                        disabled={uploading === docType}
                        className="text-xs"
                      >
                        {uploading === docType ? "…" : "Save"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

export default EmployerAccreditation;
