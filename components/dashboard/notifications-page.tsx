"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CalendarDays,
  ShieldCheck,
  Megaphone,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeading,
  Panel,
  EmptyState,
  SelectField,
} from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "./list-controls";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsPage() {
  const { state, user, api } = useDemo();
  const { run, pending } = useAction();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All notifications");
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  if (!user) return null;
  const own = state.notifications.filter((n) => n.userId === user.id);
  const unread = own.filter((n) => !n.read).length;
  const records = own.filter(
    (n) =>
      (filter !== "Unread only" || !n.read) &&
      `${n.title} ${n.message}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Your workspace"
        title="Stay in the loop."
        description="Application updates, accreditation decisions, and community notices, all in one place."
        action={
          <Button
            variant="outline"
            disabled={!unread || pending}
            onClick={() =>
              run(
                () => api.markNotification("all", true),
                "All notifications marked as read.",
              )
            }
          >
            <CheckCheck data-icon="inline-start" />
            Mark all as read
          </Button>
        }
      />
      <Panel
        title="Your notifications"
        description={`${unread} unread · Sample in-app notifications only`}
      >
        <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search your notifications…"
            className="sm:flex-[calc(100%-20px)]"
          />
          <div className="sm:w-48">
            <SelectField
              label="Notification view"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={["All notifications", "Unread only"]}
            />
          </div>
        </div>
        {records.length ? (
          <ul className="flex flex-col divide-y">
            {records.map((n) => {
              const Icon =
                n.type === "interview"
                  ? CalendarDays
                  : n.type === "accreditation"
                    ? ShieldCheck
                    : n.type === "announcement"
                      ? Megaphone
                      : Bell;
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg px-3 py-5 sm:flex-row sm:items-start",
                    !n.read && "bg-blue-soft/50",
                  )}
                >
                  <span
                    className={cn(
                      "soft-icon hidden sm:flex",
                      n.read && "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                      <h2 className="text-sm font-medium">{n.title}</h2>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      {n.message}
                    </p>
                    <time
                      dateTime={n.date}
                      className="mt-2 block text-[10px] text-muted-foreground"
                    >
                      {formatDate(n.date)}
                    </time>
                    <Button
                      variant="link"
                      className="mt-1"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          await api.markNotification(n.id, true);
                          setSelectedNotificationId(n.id);
                        })
                      }
                    >
                      View details
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() => api.markNotification(n.id, !n.read))
                    }
                  >
                    {n.read ? "Mark unread" : "Mark read"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="You’re all caught up."
            description="No notifications match this view. New sample updates will appear as you explore the connected demo."
          />
        )}
      </Panel>
      <Dialog
        open={Boolean(selectedNotificationId)}
        onOpenChange={(open) => {
          if (!open) setSelectedNotificationId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {(() => {
            const notification = own.find((item) => item.id === selectedNotificationId);
            if (!notification) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{notification.title}</DialogTitle>
                  <DialogDescription>
                    {formatDate(notification.date)}
                  </DialogDescription>
                </DialogHeader>
                <p className="leading-7 text-muted-foreground">{notification.message}</p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedNotificationId(null)}>
                    Close
                  </Button>
                  <Button onClick={() => router.push(notification.href)}>
                    View Page
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
