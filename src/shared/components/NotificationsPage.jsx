import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCheck, Search, Trash2 } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { resolveNotificationLink } from "../utils/notificationLinks";
import { getNotificationVisual } from "../utils/notificationVisual";
import { listNotifications, markRead, markAllRead, deleteNotification } from "../services/notifications";
import { PageSkeleton } from './Skeletons'
import ConfirmationModal from "./ConfirmationModal";
import Toast from "./Toast";
import { EmptyState, PageHeading, Panel, SelectField } from "./design";
import { cn } from "@/lib/utils";

// Same layout as the dashboard reference: PageHeading + one Panel, a search /
// view-control row, then a divided list. Selection and bulk delete are the only
// additions — the reference has no delete affordance, this portal does.

const VIEW_OPTIONS = [
  { value: 'all', label: 'All notifications' },
  { value: 'unread', label: 'Unread only' },
]

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
  const body = (
    <>
      <div className="flex items-center gap-2">
        {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        <h2 className="text-sm font-medium text-navy">{n.title}</h2>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{n.message}</p>
      <time dateTime={n.created_at} className="mt-2 block text-[10px] text-muted-foreground">
        {formatDate(n.created_at)}
      </time>
      {link && (
        <Link
          to={link}
          onClick={() => !n.is_read && onMarkRead?.(n.id)}
          className="text-link mt-1 text-[11px]"
        >
          View details
          <ArrowUpRight data-icon="inline-end" />
        </Link>
      )}
    </>
  );

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg px-3 py-5 sm:flex-row sm:items-start",
        !n.is_read && "bg-blue-soft/50",
      )}
    >
      <Input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggleSelect(n.id)}
        aria-label={`Select notification ${n.title}`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />
      <span data-notification-tone={visual.tone} className={cn("soft-icon hidden sm:flex", n.is_read && "bg-muted text-muted-foreground")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {body}
      </div>
      {!n.is_read && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onMarkRead(n.id)}>
          Mark read
        </Button>
      )}
    </li>
  );
}

export default function NotificationsPage({
  eyebrow = 'Your workspace',
  title = 'Stay in the loop.',
  subtitle = 'Application updates, accreditation decisions, and community notices, all in one place.',
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!user) return;
    listNotifications(user.id, { unreadOnly })
      .then((rows) => {
        setNotifications(rows || []);
        setSelected((prev) => new Set([...prev].filter((id) => (rows || []).some((r) => r.id === id))));
      })
      .catch((err) => setError(err.message || "Failed to load notifications"))
      .finally(() => setLoading(false));
  }, [user, unreadOnly]);

  async function handleMarkRead(id) {
    try {
      await markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      setError(err.message || "Failed to mark as read");
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead(user?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      setError(err.message || "Failed to mark all as read");
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
    setSelected(allSelected ? new Set() : new Set(notifications.map((n) => n.id)));
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

  const filtered = useMemo(() => {
    if (!search.trim()) return notifications;
    const q = search.toLowerCase().trim();
    return notifications.filter(
      (n) => (n.title || "").toLowerCase().includes(q) || (n.message || "").toLowerCase().includes(q)
    );
  }, [notifications, search]);

  if (loading) return <PageSkeleton stats={0} panels={2} />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const allSelected = notifications.length > 0 && notifications.every((n) => selected.has(n.id));
  const someSelected = !allSelected && notifications.some((n) => selected.has(n.id));

  return (
    <div className="space-y-6 pb-12">
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

      <PageHeading
        eyebrow={eyebrow}
        title={title}
        description={subtitle}
        action={(
          <Button type="button" variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck data-icon="inline-start" />
            Mark all as read
          </Button>
        )}
      />

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-danger-soft px-4 py-3 text-xs text-destructive">
          {error}
        </p>
      )}

      <Panel
        title="Your notifications"
        description={`${unreadCount} unread · ${notifications.length} total`}
        action={notifications.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
              <Input
                type="checkbox"
                checked={allSelected}
                disabled={notifications.length === 0}
                onChange={handleToggleSelectAll}
                aria-label="Select all notifications"
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:opacity-50"
              />
              Select all
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulk(true)}
              disabled={selected.size === 0}
              className="text-destructive"
            >
              <Trash2 data-icon="inline-start" />
              Delete selected
            </Button>
          </div>
        )}
      >
        <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="notification-search" className="sr-only">Search notifications</label>
            <InputGroup>
              <InputGroupInput
                id="notification-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your notifications…"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="sm:w-48">
            <SelectField
              label="Notification view"
              value={unreadOnly ? 'unread' : 'all'}
              onChange={(e) => {
                setUnreadOnly(e.target.value === 'unread');
                setLoading(true);
              }}
              options={VIEW_OPTIONS}
            />
          </div>
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet."
            description={unreadOnly
              ? 'You have read all your notifications.'
              : 'Updates regarding your accreditations, jobs, and system notices will appear here.'}
          />
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-semibold text-navy">No notifications match your search</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Try a different keyword, or clear the search to see everything.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y">
            {filtered.map((n) => (
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
        )}
      </Panel>
    </div>
  );
}
