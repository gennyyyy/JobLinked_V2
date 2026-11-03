"use client";

import { useState } from "react";
import { Download, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageHeading, Panel, EmptyState } from "@/components/shared";
import {
  SearchInput,
  ListPagination,
  PAGE_SIZE,
} from "@/components/dashboard/list-controls";
import { useDemo } from "@/hooks/use-demo";
import { downloadCsv, formatDate } from "@/lib/format";

export function AuditLogPage() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const records = state.auditLogs
    .filter((log) =>
      `${log.actor} ${log.action} ${log.target}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(records.length / PAGE_SIZE)),
  );
  return (
    <>
      <PageHeading
        eyebrow="A clear record of every step"
        title="Transparency is part of the work."
        description="Review approvals, posting changes, application updates, and system configuration activity."
        action={
          <Button
            variant="outline"
            disabled={!records.length}
            onClick={() =>
              downloadCsv(
                "joblinked-DEMO-audit-log.csv",
                ["DEMO timestamp", "actor", "Action", "Target"],
                records.map((log) => [
                  log.date,
                  log.actor,
                  log.action,
                  log.target,
                ]),
              )
            }
          >
            <Download data-icon="inline-start" />
            Export  log
          </Button>
        }
      />
      <Panel
        title="Workspace activity log"
        description="Read-only in the interface. This browser log is not a tamper-proof production audit system."
      >
        <div className="mb-5 max-w-xl">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search actor, action, or record…"
          />
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <time dateTime={log.date}>
                        {formatDate(log.date, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "Asia/Manila",
                        })}
                      </time>
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        Philippine time
                      </p>
                    </TableCell>
                    <TableCell>{log.actor}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <ScrollText className="size-3.5 shrink-0 text-primary" />
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-xs truncate" title={log.target}>
                        {log.target}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No activity matches this search."
            description="Clear the search or perform a workflow to add activity."
          />
        )}
        <ListPagination
          total={records.length}
          page={currentPage}
          onChange={setPage}
        />
      </Panel>
    </>
  );
}
