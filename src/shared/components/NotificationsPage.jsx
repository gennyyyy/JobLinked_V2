import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  BellRing,
  Search,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Briefcase,
  FileText,
} from "lucide-react";
import useAuth from "../hooks/useAuth";
import { resolveNotificationLink } from "../utils/notificationLinks";
import { listNotifications, markRead, markAllRead, deleteNotification } from "../services/notifications";
import LoadingScreen from "./LoadingScreen";
import ConfirmationModal from "./ConfirmationModal";
import Toast from "./Toast";

function isSystem(n) {
  return n.type === "system";
}

function SystemBadge() {
  return (
    <span className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-full uppercase border bg-primary/10 border-primary/20 text-primary font-semibold">
      System
    </span>
  );
}

function getNotificationVisual(n) {
  const type = (n.type || "").toLowerCase();
  const title = (n.title || "").toLowerCase();
  const message = (n.message || "").toLowerCase();

  if (title.includes("approved") || message.includes("approved")) {
    return {
      icon: ShieldCheck,
      colorClass: "bg-emerald-50 border-emerald-200 text-emerald-700",
      badgeClass: "bg-emerald-50 border-emerald-200 text-emerald-700",
      badgeText: "Approved",
    };
  }
  if (
    title.includes("revoked") ||
    title.includes("rejected") ||
    message.includes("revoked") ||
    message.includes("rejected")
  ) {
    return {
      icon: ShieldAlert,
      colorClass: "bg-rose-50 border-rose-200 text-rose-700",
      badgeClass: "bg-rose-50 border-rose-200 text-rose-700",
      badgeText: title.includes("revoked") ? "Revoked" : "Rejected",
    };
  }
  if (type === "accreditation" || title.includes("accreditation")) {
    return {
      icon: ShieldCheck,
      colorClass: "bg-amber-50 border-amber-200 text-amber-700",
      badgeClass: "bg-amber-50 border-amber-200 text-amber-700",
      badgeText: "Accreditation",
    };
  }
  if (type === "job" || title.includes("job")) {
    return {
      icon: Briefcase,
      colorClass: "bg-blue-50 border-blue-200 text-blue-700",
      badgeClass: "bg-blue-50 border-blue-200 text-blue-700",
      badgeText: "Job Posting",
    };
  }
  if (type === "application" || title.includes("applicant") || title.includes("application")) {
    return {
      icon: FileText,
      colorClass: "bg-indigo-50 border-indigo-200 text-indigo-700",
      badgeClass: "bg-indigo-50 border-indigo-200 text-indigo-700",
      badgeText: "Application",
    };
  }
  if (type === "system" || isSystem(n)) {
    return {
      icon: BellRing,
      colorClass: "bg-primary/10 border-primary/20 text-primary",
      badgeClass: "bg-primary/10 border-primary/20 text-primary",
      badgeText: "System",
    };
  }

  return {
    icon: Bell,
    colorClass: "bg-gray-100 border-gray-200 text-gray-600",
    badgeClass: "bg-gray-100 border-gray-200 text-gray-700",
    badgeText: "",
  };
}

function NotificationItem({ n, onMarkRead, selected, onToggleSelect, onDelete, deleting, role }) {
  const visual = getNotificationVisual(n);
  const IconComponent = visual.icon;

  const remarksMatch = n.message && n.message.match(/PESO remarks:\s*(.+)$/i);
  const remarks = remarksMatch ? remarksMatch[1] : null;
  const baseMessage = remarksMatch ? n.message.replace(/PESO remarks:\s*.+$/i, "").trim() : n.message;

  return (
    <div
      className={`p-4 transition-colors flex items-start gap-3.5 hover:bg-gray-50/80 ${!n.is_read ? "bg-primary/[0.03]" : "bg-white"
        }`}
    >
      <input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggleSelect(n.id)}
        aria-label={`Select notification ${n.title}`}
        className="mt-1 h-4 w-4 shrink-0 rounded accent-primary cursor-pointer"
      />

      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${visual.colorClass}`}
      >
        <IconComponent className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {!n.is_read && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Unread" />
            )}
            <p className="text-sm font-semibold text-gray-900">{n.title}</p>
            {isSystem(n) && <SystemBadge />}
            {visual.badgeText && !isSystem(n) && (
              <span className={`font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full uppercase border font-semibold ${visual.badgeClass}`}>
                {visual.badgeText}
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-gray-500 shrink-0">
            {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {baseMessage && (
          <p className="text-xs text-gray-600 mt-1 leading-relaxed break-words">{baseMessage}</p>
        )}

        {remarks && (
          <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-950 flex items-start gap-1.5">
            <span className="font-semibold text-amber-800 shrink-0">PESO Remarks:</span>
            <span className="break-words">{remarks}</span>
          </div>
        )}

        {resolveNotificationLink(n, role) && (
          <div className="mt-2">
            <Link
              to={resolveNotificationLink(n, role)}
              onClick={() => !n.is_read && onMarkRead?.(n.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>View details</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-gray-100">
          {!n.is_read && (
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Mark read
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(n.id)}
            disabled={!!deleting}
            className="text-xs font-medium text-danger hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
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
  const [deleting, setDeleting] = useState(() => new Set());
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

  async function handleDelete(id) {
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setToast({ message: "Notification deleted.", variant: "success" });
    } catch (err) {
      setToast({ message: err.message || "Failed to delete notification", variant: "error" });
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              INBOX
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-gray-500 font-medium">Santa Maria PESO</span>
          </div>
          <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
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

      {/* Main Single Container: Search, Filter, Actions & Notification List */}
      <div className="bg-white border border-primary rounded-lg p-5 md:p-5 shadow-xs space-y-5">
        {/* Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              aria-label="Search notifications"
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUnreadOnly((v) => !v);
                setLoading(true);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${unreadOnly
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
            >
              {unreadOnly ? "Show all" : "Unread only"}
            </button>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
            >
              Mark all read
            </button>
            <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50/70 text-xs font-medium text-gray-700 cursor-pointer select-none">
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
              <span>Select all</span>
            </label>
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              disabled={selected.size === 0}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Delete selected ({selected.size})
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Clear selection
            </button>
          </div>
        </div>

        {/* Unified Notification List */}
        <div className="divide-y divide-gray-100">
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
                onDelete={handleDelete}
                selected={selected.has(n.id)}
                deleting={deleting.has(n.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
