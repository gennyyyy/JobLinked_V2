"use client";

import { useState } from "react";
import { FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Notice } from "@/components/shared";
import { fileSize, formatDate } from "@/lib/format";
import type { FileMetadata } from "@/types";

export function DocumentPreview({
  file,
  label = "View",
}: {
  file: Pick<FileMetadata, "name"> & Partial<FileMetadata>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${file.name}`}
      >
        <Eye data-icon="inline-start" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sample document metadata</DialogTitle>
            <DialogDescription>
              Visible only in this role-guarded demo workspace. There is no file
              download or document content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-4 rounded-xl border bg-muted p-5">
            <span className="soft-icon">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="break-all text-sm font-medium text-navy">
                {file.name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {file.category ?? "Resume"} ·{" "}
                {file.size ? fileSize(file.size) : "Metadata record only"}
              </p>
              {file.addedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Added {formatDate(file.addedAt)}
                </p>
              )}
            </div>
          </div>
          <Notice title="No document was uploaded">
            JobLinked keeps temporary metadata only. Real private storage,
            access-controlled previews, and malware checks belong to the future
            backend.
          </Notice>
        </DialogContent>
      </Dialog>
    </>
  );
}
