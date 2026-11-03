import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bell, Search, AlertTriangle } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { resolveNotificationLink } from "../utils/notificationLinks";
import { getNotificationVisual } from "../utils/notificationVisual";
import { listNotifications, markRead, markAllRead, deleteNotification } from "../services/notifications";
import LoadingScreen from "./LoadingScreen";
import ConfirmationModal from "./ConfirmationModal";
import Toast from "./Toast";

function NotificationItem({ n, onMarkRead, selected, onToggleSelect, role }) {
  const visual = getNotificationVisual(n);
  const IconComponent = visual.icon;
  const link = resolveNotificationLink(n, role);

  return (
    <div
      title={n.message}
      className={`rounded-lg border border-dark-blue bg-white pl-3 pr-4 py-3 flex items-center gap-3 ${!n.is_read ? "bg-primary/[0.03]" : ""
        }`}
    >
      <input
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
        <p className="text-sm font-bold text-dark-blue truncate">{n.title}</p>
        <p className="text-[11px] text-gray-500">{visual.badgeText || "Notification"}</p>
      </div>

      {link && (
        <Link
          to={link}
          onClick={() => !n.is_read && onMarkRead?.(n.id)}
          className="inline-flex items-center whitespace-nowrap rounded-full border border-dark-blue text-dark-blue px-3 py-1 text-[10px] font-semibold uppercase shrink-0"
        >
          View details &rarr;
        </Link>
      )}
    </div>
  );
}

export default function NotificationsPage({ title = "Notifications", subtitle = "Updates on your activity" }) {
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
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-dark-blue">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 italic">{subtitle}</p>
      </header>

      {error && (
        <div className="bg-white border border-rose-100 rounded-2xl p-5 flex items-start gap-3 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.08)]">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Notification Notice</p>
            <p className="text-sm text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
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
          <button
            type="button"
            aria-pressed={unreadOnly}
            onClick={() => {
              setUnreadOnly((v) => !v);
              setLoading(true);
            }}
            className={`text-xs font-semibold rounded-lg px-3 py-2 border transition-colors cursor-pointer disabled:opacity-50 ${unreadOnly
              ? "bg-primary text-white border-primary"
              : "bg-white text-gray-600 border-gray-200"
              }`}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold rounded-lg px-3 py-2 bg-white border border-gray-200 text-gray-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            Mark as Read
          </button>
          <button
            type="button"
            onClick={() => setConfirmBulk(true)}
            disabled={selected.size === 0}
            className="text-xs font-semibold rounded-lg px-3 py-2 bg-danger text-white border border-danger hover:bg-danger/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Delete Selected
          </button>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-stretch min-w-[220px] sm:w-64"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              aria-label="Search notifications"
              className="w-full h-full pl-10 pr-3 py-2 rounded-l-lg rounded-r-none text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <button
            type="submit"
            className="bg-dark-blue text-white text-sm font-semibold px-4 rounded-r-lg cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="font-semibold text-gray-900 mb-1">No notifications yet.</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {unreadOnly
                ? "You have read all your notifications."
                : "Updates regarding your accreditations, jobs, and system notices will appear here."}
            </p>
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="text-center py-16 px-6">
            <p className="font-semibold text-gray-900 mb-1">No notifications match your search</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Try searching for a different keyword or clear the search filter.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
            >
              Clear search
            </button>
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
