import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState, useEffect } from "react";
import { FileCheck2 } from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { getEmployer } from "../../shared/services/auth";
import { listAccreditations, createAccreditation, listCompanyDocuments, uploadDocument, validateFile, signedUrl } from "../../shared/services/documents";
import { DOC_TYPES } from "../../shared/constants";
import { PageSkeleton } from '../../shared/components/Skeletons'
import { InlineError } from "../../shared/components/dashboard";
import { EmptyState, Notice, PageHeading, Panel, StatusBadge } from "../../shared/components/design";

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
  const [updating, setUpdating] = useState(false);

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

  if (loading) return <PageSkeleton stats={0} panels={2} />;
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

  const heading = (
    <PageHeading
      eyebrow="A trusted local connection"
      title="Your accreditation journey."
      description="Review your documents, read PESO feedback, and keep your requirements up to date."
      action={latest ? <StatusBadge status={statusLabel(status)} /> : null}
    />
  );

  // No application submitted yet — show a prompt to start the process explicitly
  if (status === "none") {
    return (
      <>
        {heading}
        <EmptyState
          title="Start your accreditation"
          description="To post job vacancies, your company must be accredited by PESO. Begin by submitting your application and uploading the required documents."
          action={(
            <Button onClick={handleSubmitApplication} disabled={submitting}>
              {submitting ? "Submitting…" : "Begin accreditation application"}
            </Button>
          )}
        />
      </>
    );
  }

  return (
    <>
      {heading}

      <div className="mb-6">
        <Notice
          title={status === "approved" ? "Approved" : "Publishing requires approval"}
          warning={status !== "approved"}
        >
          {status === "approved"
            ? "Your company can publish vacancies. Accredited employers may post openings visible to Santa Maria job seekers."
            : "You may save job drafts while your accreditation is reviewed. Only a PESO administrator can approve your company."}
        </Notice>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {latest?.remarks && (
            <Panel title="Feedback from the reviewer">
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{latest.remarks}</p>
            </Panel>
          )}
          <Panel
            title="Submitted document metadata"
            description={`${uploadedCount} of ${DOC_TYPES.length} uploaded · ${company?.company_name || "Your company"}`}
            action={updating ? (
              <Button variant="outline" onClick={() => setUpdating(false)}>Done</Button>
            ) : (
              <Button variant="outline" onClick={() => setUpdating(true)}>Update documents</Button>
            )}
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
                      {updating && (
                        <Label htmlFor={`doc-${docType}`} className="inline-flex min-h-8 cursor-pointer items-center rounded-lg border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                          {doc ? "Replace" : "Upload"}
                        </Label>
                      )}
                      {files[docType] && (
                        <Button onClick={() => handleUpload(docType)} disabled={uploading === docType} className="text-xs">
                          {uploading === docType ? "…" : "Save"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
        <Panel title="Review history" description="A transparent record of this accreditation.">
          {accreditations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No accreditation history yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {accreditations.map((a) => (
                <li key={a.id} className="rounded-xl border p-4">
                  <StatusBadge status={statusLabel(a.status)} />
                  {a.remarks && <p className="mt-2 text-xs leading-6 text-muted-foreground">PESO remarks: {a.remarks}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Submitted {new Date(a.submitted_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                    {a.decided_at ? ` · Decided ${new Date(a.decided_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default EmployerAccreditation;
