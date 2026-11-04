import { Button } from "../../components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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

// Bell opens a preview panel of the four newest notifications; the history page
// (list/filter/mark-read/bulk actions) stays reachable via "Show all" in the
// panel footer. `rows` lets a shell that already fetched them (TopNavLayout)
// hand them over instead of paying for a second request.
function NotificationBell({ dark = false, align = "right", rows: controlledRows }) {
  const { user } = useAuth();
  const [ownRows, setOwnRows] = useState([]);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const controlled = Array.isArray(controlledRows);
  const rows = controlled ? controlledRows : ownRows;

  const refresh = useCallback((force = false) => {
    if (!user || controlled) return;
    const promise =
      !force && cache.promise && cache.userId === user.id
        ? cache.promise
        : fetchRows(user.id);
    promise.then(setOwnRows);
  }, [user, controlled]);

  useEffect(() => {
    if (!user || controlled) return;
    refresh();
    const onChange = () => refresh(true);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChange);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChange);
  }, [user, refresh, controlled]);

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
      <Button
        type="button"
        ref={triggerRef}
        variant={dark ? 'default' : 'ghost'}
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`relative p-2 rounded-lg border cursor-pointer ${
          dark
            ? "text-white/70 hover:text-white hover:bg-card/10 border-white/20"
            : "text-muted-foreground hover:text-foreground hover:bg-muted border-border"
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
      </Button>

      {/* ponytail: closes instantly — an exit animation needs the panel kept
          mounted for the transition duration; add when the hard cut is noticed. */}
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className={`absolute top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border bg-card shadow-xl animate-[dropdown-in_150ms_ease-out] sm:w-80 ${
            align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right"
          }`}
        >
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">Notifications</h2>
            <p className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "You're caught up"}
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="flex max-h-96 flex-col divide-y overflow-y-auto">
              {rows.slice(0, 4).map((n) => {
                const { icon: Icon, colorClass, tone } = getNotificationVisual(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(n)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                        !n.is_read ? "bg-blue-soft/40" : ""
                      }`}
                    >
                      <span
                        data-notification-tone={tone}
                        className={`notification-icon flex size-8 shrink-0 items-center justify-center rounded-lg border ${colorClass}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-navy">
                        {n.title || n.message || "Notification"}
                      </span>
                      {!n.is_read && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to={`/${role}/notifications`}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t px-4 py-3 text-xs font-medium text-primary transition-colors hover:bg-muted/60"
          >
            Show all notifications
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
