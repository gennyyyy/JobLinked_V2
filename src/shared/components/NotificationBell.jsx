import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useId, useRef } from "react";
import { listNotifications, markRead } from "../services/notifications";
import { NOTIFICATIONS_CHANGED } from "../utils/notificationEvents";
import { resolveNotificationLink } from "../utils/notificationLinks";
import { getNotificationVisual } from "../utils/notificationVisual";
import useAuth from "../hooks/useAuth";

// PortalLayout mounts the bell twice (mobile header + desktop sidebar), so share
// one fetch and one row set across instances. The cache lives only while a fetch
// is in flight: both bells mount in the same commit and join it, a fresh mount
// refetches, and the NOTIFICATIONS_CHANGED event always bypasses it.
let cache = { userId: null, rows: [], promise: null };

function fetchRows(userId) {
  const promise = listNotifications(userId)
    .then((rows) => {
      const next = rows || [];
      if (cache.promise === promise) cache = { userId, rows: next, promise: null };
      return next;
    })
    .catch(() => {
      if (cache.promise === promise) cache = { userId, rows: [], promise: null };
      return [];
    });
  cache = { userId, rows: [], promise };
  return promise;
}

// Bell opens a preview panel of the newest notifications; the history page
// (list/filter/mark-read/bulk actions) stays reachable via SEE ALL in the panel.
function NotificationBell({ dark = false, align = "right" }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const refresh = useCallback((force = false) => {
    if (!user) return;
    const promise =
      !force && cache.promise && cache.userId === user.id
        ? cache.promise
        : fetchRows(user.id);
    promise.then(setRows);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const onChange = () => refresh(true);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChange);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChange);
  }, [user, refresh]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const role = user.role;
  const unread = rows.filter((n) => !n.is_read).length;

  function handleRowClick(n) {
    // Fire-and-forget, but never floated: a failing mark-read must not surface
    // an unhandled rejection (same soft-failure convention as the fetch above).
    if (!n.is_read) markRead(n.id).catch(() => {});
    const link = resolveNotificationLink(n, role);
    if (!link) return;
    setOpen(false);
    navigate(link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`relative p-2 rounded-lg border cursor-pointer ${
          dark
            ? "text-white/70 hover:text-white hover:bg-white/10 border-white/20"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-200"
        }`}
      >
        <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ponytail: closes instantly — an exit animation needs the panel kept
          mounted for the transition duration; add when the hard cut is noticed. */}
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className={`absolute top-full mt-2 w-72 sm:w-80 rounded-xl border-2 border-dark-blue dark:border-[var(--theme-border)] bg-white shadow-lg z-30 p-3 animate-[dropdown-in_150ms_ease-out] ${
            align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right"
          }`}
        >
          <div className="flex items-start justify-between gap-3 px-1 pb-2">
            <div>
              <h2 className="text-sm font-bold text-dark-blue">Notification</h2>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Latest</p>
            </div>
            <Link
              to={`/${role}/notifications`}
              onClick={() => setOpen(false)}
              className="inline-flex items-center whitespace-nowrap rounded-full border border-dark-blue bg-primary/10 text-primary px-3 py-1 text-[10px] font-semibold uppercase"
            >
              SEE ALL &rarr;
            </Link>
          </div>

          {rows.length === 0 ? (
            <p className="px-1 py-2 text-xs text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="space-y-2">
              {rows.slice(0, 5).map((n) => {
                const { icon: Icon, colorClass, tone } = getNotificationVisual(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(n)}
                      className={`w-full cursor-pointer text-left rounded-lg border border-dark-blue bg-white pl-2.5 pr-4 py-3 flex items-center gap-3 ${
                        !n.is_read ? "bg-primary/[0.03]" : ""
                      }`}
                    >
                      <span
                        data-notification-tone={tone}
                        className={`notification-icon w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${colorClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-bold text-dark-blue truncate">
                        {n.title || n.message || "Notification"}
                      </span>
                      {!n.is_read && (
                        <span className="w-2 h-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
