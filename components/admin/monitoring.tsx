"use client";

import { useState } from "react";
import { Download, Handshake, Users, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  PageHeading,
  Panel,
  SelectField,
  StatusBadge,
  StatCards,
  EmptyState,
} from "@/components/shared";
import {
  SearchInput,
  ListPagination,
  PAGE_SIZE,
} from "@/components/dashboard/list-controls";
import { ApplicationTimeline } from "@/components/dashboard/application-timeline";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { BARANGAYS, APPLICATION_STATUSES } from "@/constants";
import { formatDate, downloadCsv } from "@/lib/format";

export function ApplicationMonitoring() {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [barangay, setBarangay] = useState("");
  const [referral, setReferral] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const records = state.applications.filter((a) => {
    const seeker = state.seekers.find((s) => s.id === a.seekerId);
    const job = state.jobs.find((j) => j.id === a.jobId);
    const company = state.employers.find((e) => e.id === job?.employerId);
    return (
      (!status || a.status === status) &&
      (!barangay || seeker?.barangay === barangay) &&
      (!referral || a.referred === (referral === "Referred")) &&
      `${seeker?.name} ${job?.title} ${company?.name}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(records.length / PAGE_SIZE)),
  );
  const application = state.applications.find((a) => a.id === selected);
  const exportRecords = () =>
    downloadCsv(
      "joblinked-DEMO-applications.csv",
      [
        " application ID",
        "Job title",
        "Employer",
        "Barangay",
        "Submitted",
        "Current status",
        " referral",
        "placement",
      ],
      records.map((a) => {
        const job = state.jobs.find((j) => j.id === a.jobId);
        return [
          a.id,
          job?.title ?? "",
          state.employers.find((e) => e.id === job?.employerId)?.name ?? "",
          state.seekers.find((s) => s.id === a.seekerId)?.barangay ?? "",
          a.submittedAt.slice(0, 10),
          a.status,
          a.referred ? "Yes" : "No",
          a.status === "Hired" ? "Yes" : "No",
        ];
      }),
    );
  return (
    <>
      <PageHeading
        eyebrow="Follow every connection"
        title="From opportunity to a new beginning."
        description="Monitor recruitment outcomes and record  referral markers. No external referral is sent."
        action={
          <Button
            variant="outline"
            disabled={!records.length}
            onClick={exportRecords}
          >
            <Download data-icon="inline-start" />
            Export  CSV
          </Button>
        }
      />
      <StatCards
        stats={[
          {
            label: "Applications in view",
            value: records.length,
            icon: ClipboardList,
          },
          {
            label: "Recorded referrals",
            value: records.filter((a) => a.referred).length,
            icon: Handshake,
          },
          {
            label: "placements",
            value: records.filter((a) => a.status === "Hired").length,
            icon: Users,
            tone: "teal",
          },
          {
            label: "Interview stage",
            value: records.filter((a) => a.status === "Interview Scheduled")
              .length,
            icon: Users,
            tone: "teal",
          },
        ]}
      />
      <Panel
        title="Applications & placements"
        description="Placement means an application currently marked Hired. These are provided outcomes."
      >
        <div className="mb-5 flex flex-col gap-3">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search candidate, vacancy, or employer…"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="Recruitment status"
              placeholder="All statuses"
              options={APPLICATION_STATUSES}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
            <SelectField
              label="Candidate barangay"
              placeholder="All 24 barangays"
              options={BARANGAYS}
              value={barangay}
              onChange={(e) => {
                setBarangay(e.target.value);
                setPage(1);
              }}
            />
            <SelectField
              label="Referral marker"
              placeholder="All referral outcomes"
              options={["Referred", "Not referred"]}
              value={referral}
              onChange={(e) => {
                setReferral(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate & vacancy</TableHead>
                <TableHead>Barangay</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead> referral</TableHead>
                <TableHead>History</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((a) => {
                  const seeker = state.seekers.find((s) => s.id === a.seekerId);
                  const job = state.jobs.find((j) => j.id === a.jobId);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium text-navy">{seeker?.name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {job?.title}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {
                            state.employers.find(
                              (e) => e.id === job?.employerId,
                            )?.name
                          }
                        </p>
                      </TableCell>
                      <TableCell>{seeker?.barangay}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                        {a.status === "Hired" && (
                          <p className="mt-2 text-[10px] text-teal">
                            placement recorded
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={a.referred ? "secondary" : "outline"}
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => api.referApplication(a.id, !a.referred),
                              a.referred
                                ? " referral marker removed."
                                : " referral recorded; nothing was sent externally.",
                            )
                          }
                        >
                          {a.referred ? "Referred · remove" : "Record referral"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          onClick={() => setSelected(a.id)}
                          aria-label={`View application history for ${seeker?.name}`}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No recruitment records match."
            description="Try another status, barangay, referral marker, or search."
          />
        )}
        <ListPagination
          total={records.length}
          page={currentPage}
          onChange={setPage}
        />
      </Panel>
      <Dialog
        open={!!application}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {application && (
            <>
              <DialogHeader>
                <DialogTitle>recruitment history</DialogTitle>
                <DialogDescription>
                  {
                    state.seekers.find((s) => s.id === application.seekerId)
                      ?.name
                  }{" "}
                  · {state.jobs.find((j) => j.id === application.jobId)?.title}{" "}
                  · Submitted {formatDate(application.submittedAt)}
                </DialogDescription>
              </DialogHeader>
              <ApplicationTimeline application={application} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
