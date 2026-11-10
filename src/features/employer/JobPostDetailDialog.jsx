import { Button } from "../../components/ui/button";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Users, X } from "lucide-react";
import useDialog from "../../shared/hooks/useDialog";
import { StatusBadge } from "../../shared/components/design";
import { formatSalary } from "./jobPostFields";

// Section label/value pair inside the read-only detail dialog.
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-medium text-navy">{children}</p>
    </div>
  );
}

export default function JobPostDetailDialog({ job, company, onClose, onEdit, onToggleClose, onDelete }) {
  const viewPanelRef = useDialog(onClose);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div
        ref={viewPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-view-title"
        className="my-8 max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl md:p-6"
      >
        {/* Modal Top Bar */}
        <div className="flex items-start justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={job.status === "published" ? "Published" : job.status === "closed" ? "Closed" : "Draft"} />
              {job.office && <span className="truncate text-[10px] text-muted-foreground">Dept: {job.office}</span>}
            </div>
            <h2 id="job-view-title" className="text-xl font-semibold tracking-[-.02em] text-navy">{job.title}</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {company?.company_name || "My Company"} · Posted on {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onClose()} aria-label="Close job details">
            <X />
          </Button>
        </div>

        {/* Quick Fact Grid */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted p-4 sm:grid-cols-2">
          <Fact label="Employment">{job.employment_type}</Fact>
          <Fact label="Work arrangement">{job.work_arrangement || "On-site"}</Fact>
          <Fact label="Location">Brgy. {job.location}</Fact>
          <Fact label="Vacancies">{job.vacancies} open</Fact>
          <Fact label="Salary">{formatSalary(job.salary_min, job.salary_max)}</Fact>
        </div>

        {/* Tags */}
        {job.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-blue-soft px-2 py-0.5 text-[10px] font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Candidate Applications Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/10 bg-blue-soft p-4">
          <div className="flex items-center gap-3">
            <Users className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-navy">{job.applicant_count || 0} Candidates Applied</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Track and review resumes in your applicant pipeline</p>
            </div>
          </div>
          <Link to="/employer/applicants" className="text-link text-xs">
            View Applicants →
          </Link>
        </div>

        {[
          ["Job Description", job.description],
          ["Qualifications & Requirements", job.requirements],
          ["Benefits & Perks", job.benefits],
          ["Application Instructions", job.instructions],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <h3 className="mb-2 text-xs font-semibold text-navy">{label}</h3>
              <p className="rounded-xl border bg-muted p-4 text-xs leading-6 whitespace-pre-line text-muted-foreground">
                {value}
              </p>
            </div>
          ))}

        {/* Modal Bottom Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              onEdit(job);
            }}
            className="text-xs"
          >
            Edit Listing
          </Button>

          {(job.status === "published" || job.status === "closed") && (
            <Button type="button" variant="outline" onClick={() => onToggleClose(job)} className="text-xs">
              {job.status === "published" ? "Close Job" : "Reopen Job"}
            </Button>
          )}

          <Button type="button" variant="ghost" onClick={() => onDelete(job)} className="text-xs text-destructive hover:bg-danger-soft">
            Delete posting
          </Button>

          <Button type="button" variant="secondary" onClick={() => onClose()} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
