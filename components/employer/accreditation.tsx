"use client";

import { useState } from "react";
import { ShieldCheck, Send, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FilePicker } from "@/components/forms/file-picker";
import { DocumentPreview } from "@/components/dashboard/document-preview";
import {
  PageHeading,
  Panel,
  StatusBadge,
  Notice,
  ConfirmButton,
} from "@/components/shared";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import type { Accreditation, Employer, FileMetadata } from "@/types";

export function EmployerAccreditation() {
  const { state, employer } = useDemo();
  const accreditation = state.accreditations.find(
    (a) => a.employerId === employer?.id,
  );
  return employer && accreditation ? (
    <AccreditationWorkspace
      key={employer.id}
      company={employer}
      accreditation={accreditation}
    />
  ) : null;
}

function AccreditationWorkspace({
  company,
  accreditation,
}: {
  company: Employer;
  accreditation: Accreditation;
}) {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const [documents, setDocuments] = useState<FileMetadata[]>(
    accreditation.documents,
  );
  const [editing, setEditing] = useState(accreditation.status !== "Approved");
  const [error, setError] = useState("");
  const complete = state.preferences.requirements.every((category) =>
    documents.some((d) => d.category === category),
  );
  const submit = () =>
    run(async () => {
      if (!complete) {
        setError(
          "Attach metadata for every required document category.",
        );
        throw new Error("Attach a file for every required category.");
      }
      await api.submitAccreditation(documents);
      setError("");
      setEditing(false);
    }, "accreditation submitted for PESO review.");
  return (
    <>
      <PageHeading
        eyebrow="A trusted local connection"
        title="Your accreditation journey."
        description="Review your documents, read PESO feedback, and keep your requirements up to date."
        action={<StatusBadge status={accreditation.status} />}
      />
      <div className="mb-6">
        <Notice
          title={
            accreditation.status === "Approved"
              ? "Approved in the  only"
              : "Publishing requires approval"
          }
          warning={accreditation.status !== "Approved"}
        >
          {accreditation.status === "Approved"
            ? "Your company can publish vacancies. This is not actual municipal verification or an official government decision."
            : "You may save job drafts while your accreditation is reviewed. Only a PESO  administrator can approve your company."}
        </Notice>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {accreditation.feedback && (
            <Panel title="Feedback from the reviewer">
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {accreditation.feedback}
              </p>
            </Panel>
          )}
          <Panel
            title="Submitted document metadata"
            description={`Last submitted ${formatDate(accreditation.submittedAt)} · ${company.name}`}
            action={
              !editing && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Update documents
                </Button>
              )
            }
          >
            <ul className="flex flex-col gap-4">
              {accreditation.documents.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileCheck2 className="size-5 shrink-0 text-teal" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-navy">
                        {file.category}
                      </p>
                      <p className="mt-1 max-w-[240px] truncate text-[10px] text-muted-foreground">
                        {file.name}
                      </p>
                    </div>
                  </div>
                  <DocumentPreview file={file} />
                </li>
              ))}
            </ul>
          </Panel>
          {editing && (
            <Panel
              title={
                accreditation.status === "Rejected" ||
                accreditation.status === "Resubmission Requested"
                  ? "Update & resubmit requirements"
                  : "Prepare document metadata"
              }
              description="Requirements are configurable by the PESO  administrator."
            >
              <FieldGroup>
                {state.preferences.requirements.map((category) => (
                  <FilePicker
                    key={category}
                    label={category}
                    category={category}
                    compliance
                    value={documents.find((d) => d.category === category)}
                    onChange={(file) =>
                      setDocuments((items) => [
                        ...items.filter((d) => d.category !== category),
                        file,
                      ])
                    }
                  />
                ))}
                {error && (
                  <p className="text-xs text-destructive" role="alert">
                    {error}
                  </p>
                )}
                {accreditation.status === "Approved" ? (
                  <ConfirmButton
                    variant="outline"
                    title="Submit accreditation for another review?"
                    description="Your company will return to Pending Review. New publishing will be restricted until the PESO  administrator approves it again."
                    onConfirm={submit}
                  >
                    <Send data-icon="inline-start" />
                    Submit updated documents
                  </ConfirmButton>
                ) : (
                  <Button disabled={pending || !complete} onClick={submit}>
                    <Send data-icon="inline-start" />
                    {pending
                      ? "Submitting metadata…"
                      : "Submit for  review"}
                  </Button>
                )}
                <p className="text-[11px] leading-6 text-muted-foreground">
                  No file contents are transmitted. Selecting a file
                  records temporary metadata only. Existing metadata may
                  be reused for this workflow.
                </p>
              </FieldGroup>
            </Panel>
          )}
        </div>
        <Panel
          title="Review history"
          description="A transparent record of this accreditation."
        >
          <ol className="flex flex-col gap-5">
            {[...accreditation.history].reverse().map((event, index) => (
              <li
                key={`${event.date}-${index}`}
                className="flex items-start gap-3"
              >
                <span className="soft-icon">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <StatusBadge status={event.status} />
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {event.reason}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {event.reviewer} · {formatDate(event.date)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
