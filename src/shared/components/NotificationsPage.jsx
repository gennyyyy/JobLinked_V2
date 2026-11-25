import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Search, Trash2 } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { resolveNotificationLink } from "../utils/notificationLinks";
import { getNotificationVisual } from "../utils/notificationVisual";
import { listNotifications, markRead, deleteNotification } from "../services/notifications";
import { PageSkeleton } from './Skeletons'
import ConfirmationModal from "./ConfirmationModal";
import Flash from "./Flash";
import Toast from "./Toast";
import { EmptyState, PageHeading, Panel } from "./design";
import { Pager } from "./dashboard";
import { cn } from "@/lib/utils";

// One Panel: All/Unread segmented tabs + search in a single row, a slim bulk
// toolbar above the list, then compact rows. Filtering is client-side so the
// tab counts and select-all always agree with the loaded array.

const PAGE_SIZE = 8

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function NotificationRow({ n, role, selected, onToggleSelect, onMarkRead }) {
  const visual = getNotificationVisual(n);
  const Icon = visual.icon;
  const link = resolveNotificationLink(n, role);
  const date = formatDate(n.created_at);
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg px-3 py-3",
        !n.is_read && "bg-blue-soft/50",
      )}
    >
      <Input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggleSelect(n.id)}
        aria-label={`Select notification ${n.title}`}
        className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />
      <span data-notification-tone={visual.tone} className={cn("soft-icon hidden sm:flex", n.is_read && "bg-muted text-muted-foreground")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-x-2">
          {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          <h2 className={cn("text-sm font-medium", n.is_read ? "text-navy/60" : "text-navy")}>{n.title}</h2>
          {date && (
            <time dateTime={n.created_at} className="whitespace-nowrap text-micro text-muted-foreground">
              · {date}
            </time>
          )}
        </div>
        <p className={cn("text-xs leading-6", n.is_read ? "text-muted-foreground" : "text-navy/80")}>{n.message}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {!n.is_read && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onMarkRead(n.id)}>
            <Check data-icon="inline-start" />
            Mark read
          </Button>
        )}
        {link && (
          <Link
            to={link}
            onClick={() => !n.is_read && onMarkRead?.(n.id)}
            className="text-link text-xs"
          >
            View details
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        )}
      </div>
    </li>
  );
}

export default function NotificationsPage({
  title = 'Stay in the loop.',
  subtitle = 'Application updates, accreditation decisions, and community notices, all in one place.',
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!user) return;
    listNotifications(user.id)
      .then((rows) => {
        setNotifications(rows || []);
        setSelected((prev) => new Set([...prev].filter((id) => (rows || []).some((r) => r.id === id))));
      })
      .catch((err) => setError(err.message || "Failed to load notifications"))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = notifications.filter((n) => {
    if (view === "unread" && n.is_read) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (n.title || "").toLowerCase().includes(q) || (n.message || "").toLowerCase().includes(q);
  });

  async function handleMarkRead(id) {
    try {
      await markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      setError(err.message || "Failed to mark as read");
    }
  }

  function handleToggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((n) => n.id)));
  }

  async function handleBulkMarkRead() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => markRead(id)));
    const succeeded = ids.filter((_, i) => results[i].status === "fulfilled");
    const failed = ids.length - succeeded.length;
    setNotifications((prev) => prev.map((n) => (succeeded.includes(n.id) ? { ...n, is_read: true } : n)));
    setSelected((prev) => new Set([...prev].filter((id) => !succeeded.includes(id))));
    if (failed > 0) {
      setToast({ message: `Marked ${succeeded.length} of ${ids.length} as read, ${failed} failed`, variant: "error" });
    } else {
      setToast({ message: `${succeeded.length} notification(s) marked as read.`, variant: "success" });
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => deleteNotification(id)));
    const succeeded = ids.filter((_, i) => results[i].status === "fulfilled");
    const failed = ids.length - succeeded.length;
    setNotifications((prev) => prev.filter((n) => !succeeded.includes(n.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !succeeded.includes(id))));
    if (failed > 0) {
      setToast({ message: `Deleted ${succeeded.length} of ${ids.length}, ${failed} failed`, variant: "error" });
    } else {
      setToast({ message: `${succeeded.length} notification(s) deleted.`, variant: "success" });
    }
  }

  if (loading) return <PageSkeleton stats={0} panels={2} />;

  const allCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const allSelected = filtered.length > 0 && filtered.every((n) => selected.has(n.id));
  const someSelected = !allSelected && filtered.some((n) => selected.has(n.id));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const tabClass = (active) => cn(
    "min-h-9 rounded-md px-3 text-xs font-medium transition-colors",
    active ? "bg-primary text-white" : "text-muted-foreground hover:text-navy",
  );

  return (
    <>
      <Toast message={toast?.message} variant={toast?.variant} onClose={closeToast} />
      {confirmBulk && (
        <ConfirmationModal
          message={`Delete ${selected.size} notification(s)?`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmBulk(false)}
          onConfirm={() => {
            setConfirmBulk(false);
            handleBulkDelete();
          }}
        />
      )}

      <PageHeading title={title} description={subtitle} />

      {error && (
        <Flash variant="error">{error}</Flash>
      )}

      <Panel
        title="Your notifications"
        description={`${unreadCount} unread · ${allCount} total`}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <label htmlFor="notification-search" className="sr-only">Search notifications</label>
            <InputGroup>
              <InputGroupInput
                id="notification-search"
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search your notifications…"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-1" role="group" aria-label="Filter notifications">
            <button
              type="button"
              aria-pressed={view === "all"}
              onClick={() => { setView("all"); setPage(1); setSelected(new Set()); }}
              className={tabClass(view === "all")}
            >
              All ({allCount})
            </button>
            <button
              type="button"
              aria-pressed={view === "unread"}
              onClick={() => { setView("unread"); setPage(1); setSelected(new Set()); }}
              className={tabClass(view === "unread")}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {allCount === 0 ? (
          <EmptyState
            title="No notifications yet."
            description="Updates regarding your accreditations, jobs, and system notices will appear here."
          />
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <div className="py-14 text-center">
              <p className="text-sm font-semibold text-navy">No notifications match this search.</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Clear the search to see all notifications.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </div>
          ) : (
            <EmptyState
              title="No unread notifications."
              description="You have read all your notifications."
            />
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Select all notifications"
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                />
                Select all
              </label>
              {selected.size > 0 && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={handleBulkMarkRead}>
                    Mark selected as read
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmBulk(true)}
                    className="text-destructive"
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete selected
                  </Button>
                </>
              )}
            </div>
            <ul className="flex flex-col divide-y">
              {visible.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  role={user?.role}
                  selected={selected.has(n.id)}
                  onToggleSelect={handleToggleSelect}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </ul>
            <Pager page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} label="notifications" />
          </>
        )}
      </Panel>
    </>
  );
}
