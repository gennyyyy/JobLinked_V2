"use client";

import { Check, Clock3, CircleX, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/types";

export function ApplicationTimeline({
  application,
}: {
  application: JobApplication;
}) {
  return (
    <div className="flex flex-col gap-6">
      {application.interview &&
        application.status === "Interview Scheduled" && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-blue-soft p-4">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-navy">
                Your sample interview
              </p>
              <p className="mt-2 text-xs leading-6 text-navy">
                {formatDate(application.interview.date, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Asia/Manila",
                })}{" "}
                · Philippine time
              </p>
              <p className="text-xs leading-6 text-muted-foreground">
                {application.interview.location}
              </p>
            </div>
          </div>
        )}
      <ol aria-label="Application status history" className="flex flex-col">
        {application.timeline.map((event, index) => {
          const last = index === application.timeline.length - 1;
          const rejected = event.status === "Rejected";
          return (
            <li key={`${event.date}-${index}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "timeline-dot",
                    rejected && "bg-danger-soft text-destructive",
                    event.status === "Hired" && "bg-success-soft text-success",
                  )}
                >
                  {rejected ? (
                    <CircleX className="size-4" />
                  ) : last ? (
                    <Clock3 className="size-4" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </span>
                {!last && <div className="min-h-10 w-px flex-1 bg-border" />}
              </div>
              <div className={cn("min-w-0 flex-1 pb-7", last && "pb-0")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={event.status} />
                  <time
                    className="text-[11px] text-muted-foreground"
                    dateTime={event.date}
                  >
                    {formatDate(event.date)}
                  </time>
                </div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {event.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="rounded-lg bg-muted px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        This is a sample recruitment history, not a guaranteed sequence.
        Employers may skip stages; rejection is a final outcome, not a required
        step.
      </p>
    </div>
  );
}
