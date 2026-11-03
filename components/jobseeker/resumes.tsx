"use client";

import { useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/forms/file-picker";
import {
  PageHeading,
  Panel,
  Notice,
  EmptyState,
  ConfirmButton,
} from "@/components/shared";
import { DocumentPreview } from "@/components/dashboard/document-preview";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { fileSize, formatDate } from "@/lib/format";
import type { FileMetadata } from "@/types";

export function ResumeManagement({ embedded = false }: { embedded?: boolean }) {
  const { seeker, api } = useDemo();
  const { run, pending } = useAction();
  const [draft, setDraft] = useState<FileMetadata>();
  const [replacing, setReplacing] = useState<string | null>(null);
  if (!seeker) return null;
  return (
    <>
      {!embedded && (
        <PageHeading
          eyebrow="Put your best foot forward"
          title="Your resume, ready to go."
          description="Keep one resume. Replace it whenever you need an updated version."
        />
      )}
      <div className="mb-6">
        <Notice title="Metadata-only nstration">
          No document content is read, uploaded, or stored. Use files
          only. Selected filenames and metadata disappear on refresh.
        </Notice>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="My resumes">
          {seeker.resumes.length ? (
            <ul className="flex flex-col gap-4">
              {seeker.resumes.map((file) => (
                <li className="rounded-xl border p-4" key={file.id}>
                  <div className="flex items-start gap-3">
                    <span className="soft-icon">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-all text-sm font-medium">
                        {file.name}
                      </h2>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {fileSize(file.size)} · Added {formatDate(file.addedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <DocumentPreview file={file} />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setReplacing(file.id);
                        setDraft(undefined);
                      }}
                    >
                      Replace
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      title="Delete this resume?"
                      description="This removes the metadata from your profile. Existing applications keep the name of the resume used when they were submitted."
                      onConfirm={() =>
                        run(
                          () => api.deleteResume(file.id),
                          "Resume metadata removed.",
                        )
                      }
                    >
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Start with your story."
              description="Add a resume using the form. Only its filename, size, and type will be kept in this session."
            />
          )}
        </Panel>
        <Panel
          title={replacing ? "Replace a resume" : "Add a resume"}
          description="PDF, DOC, or DOCX · Up to 5 MB"
        >
          {seeker.resumes.length > 0 && !replacing ? (
            <p className="text-sm text-muted-foreground">Your single resume slot is occupied. Choose Replace on your current resume to upload an updated version.</p>
          ) : <div className="flex flex-col gap-5">
            <FilePicker
              key={replacing ?? "new"}
              label="Choose a resume"
              value={draft}
              onChange={setDraft}
            />
            <Button
              disabled={
                !draft || pending || (!replacing && seeker.resumes.length >= 1)
              }
              onClick={() =>
                run(
                  async () => {
                    if (!draft) return;
                    if (replacing) await api.replaceResume(replacing, draft);
                    else await api.addResume(draft);
                    setDraft(undefined);
                    setReplacing(null);
                  },
                  replacing
                    ? "resume metadata replaced."
                    : "resume metadata added.",
                )
              }
            >
              <UploadCloud data-icon="inline-start" />
              {pending
                ? "Saving metadata…"
                : replacing
                  ? "Replace metadata"
                  : "Add resume metadata"}
            </Button>
            {replacing && (
              <Button
                variant="ghost"
                onClick={() => {
                  setReplacing(null);
                  setDraft(undefined);
                }}
              >
                Cancel replacement
              </Button>
            )}
            <p className="text-[11px] leading-6 text-muted-foreground">
              Replacing a resume does not alter an already submitted
              application. For a production service, upload and access controls
              will be enforced by the backend.
            </p>
          </div>}
        </Panel>
      </div>
    </>
  );
}
