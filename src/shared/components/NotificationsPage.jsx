import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, AlertTriangle } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { resolveNotificationLink } from "../utils/notificationLinks";
import { getNotificationVisual } from "../utils/notificationVisual";
import { listNotifications, markRead, markAllRead, deleteNotification } from "../services/notifications";
import LoadingScreen from "./LoadingScreen";
import ConfirmationModal from "./ConfirmationModal";
import Toast from "./Toast";
import { EmptyState } from "./design";

function NotificationItem({ n, onMarkRead, selected, onToggleSelect, role }) {
  const visual = getNotificationVisual(n);
  const IconComponent = visual.icon;
  const link = resolveNotificationLink(n, role);

  return (
    <div
      title={n.message}
      className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${!n.is_read ? "border-primary/25 bg-blue-soft/40" : ""}`}
    >
      <Input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggleSelect(n.id)}
        aria-label={`Select notification ${n.title}`}
        className="h-4 w-4 shrink-0 rounded accent-primary cursor-pointer"
      />

      <div
        data-notification-tone={visual.tone}
        className={`notification-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${visual.colorClass}`}
      >
        <IconComponent className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy">{n.title}</p>
        <p className="text-[11px] text-muted-foreground">{visual.badgeText || "Notification"}</p>
      </div>

      {link && (
        <Link
          to={link}
          onClick={() => !n.is_read && onMarkRead?.(n.id)}
          className="inline-flex shrink-0 items-center whitespace-nowrap text-[11px] font-medium text-primary"
        >
          View details &rarr;
        </Link>
      )}
    </div>
  );
}

export default function NotificationsPage({ eyebrow = 'Your workspace', title = 'Stay in the loop.', subtitle = 'Application updates, accreditation decisions, and community notices, all in one place.' }) {
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

  if (loading) return <LoadingScreen />;

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
      {/* Header Section */}
      <header>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-[-.035em] text-navy md:text-[30px]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </header>

      {error && (
        <div className="bg-card border border-rose-100 rounded-2xl p-5 flex items-start gap-3 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.08)]">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Notification Notice</p>
            <p className="text-sm text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border bg-white p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="checkbox"
            checked={allSelected}
            disabled={notifications.length === 0}
            onChange={handleToggleSelectAll}
            aria-label="Select all notifications"
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            className="h-4 w-4 shrink-0 rounded accent-primary disabled:opacity-50 cursor-pointer"
          />
          <Button
            type="button"
            aria-pressed={unreadOnly}
            onClick={() => {
              setUnreadOnly((v) => !v);
              setLoading(true);
            }}
            className={`text-xs font-semibold rounded-lg px-3 py-2 border transition-colors cursor-pointer disabled:opacity-50 ${unreadOnly
              ? "bg-primary text-white border-primary"
              : "bg-card text-muted-foreground border-border"
              }`}
          >
            Unread
          </Button>
          <Button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold rounded-lg px-3 py-2 bg-card border border-border text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            Mark as Read
          </Button>
          <Button
            type="button"
            onClick={() => setConfirmBulk(true)}
            disabled={selected.size === 0}
            className="text-xs font-semibold rounded-lg px-3 py-2 bg-danger text-white border border-danger hover:bg-danger/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Delete Selected
          </Button>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-stretch min-w-[220px] sm:w-64"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              aria-label="Search notifications"
              className="w-full h-full pl-10 pr-3 py-2 rounded-l-lg rounded-r-none text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <Button
            type="submit"
            className="bg-navy text-white text-sm font-semibold px-4 rounded-r-lg cursor-pointer"
          >
            Search
          </Button>
        </form>
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet."
            description={unreadOnly
              ? 'You have read all your notifications.'
              : 'Updates regarding your accreditations, jobs, and system notices will appear here.'}
          />
        ) : filtered.length === 0 && search ? (
          <div className="text-center py-16 px-6">
            <p className="font-semibold text-foreground mb-1">No notifications match your search</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Try searching for a different keyword or clear the search filter.
            </p>
            <Button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground bg-muted hover:bg-gray-200 border border-border transition-colors cursor-pointer"
            >
              Clear search
            </Button>
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              role={user?.role}
              onMarkRead={handleMarkRead}
              onToggleSelect={handleToggleSelect}
              selected={selected.has(n.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
