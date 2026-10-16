import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { listNotifications } from "../services/notifications";
import { NOTIFICATIONS_CHANGED } from "../utils/notificationEvents";
import useAuth from "../hooks/useAuth";

// PortalLayout mounts the bell twice (mobile header + desktop sidebar), so share
// one fetch and one count across instances. The cache lives only while a fetch
// is in flight: both bells mount in the same commit and join it, a fresh mount
// refetches, and the NOTIFICATIONS_CHANGED event always bypasses it.
let cache = { userId: null, unread: 0, promise: null };

function fetchUnread(userId) {
  const promise = listNotifications(userId)
    .then((rows) => {
      const unread = (rows || []).filter((n) => !n.is_read).length;
      if (cache.promise === promise) cache = { userId, unread, promise: null };
      return unread;
    })
    .catch(() => {
      if (cache.promise === promise) cache = { userId, unread: 0, promise: null };
      return 0;
    });
  cache = { userId, unread: 0, promise };
  return promise;
}

// Bell is a plain link to the portal's notification history page —
// the page owns list/filter/mark-read, so no dropdown preview here.
function NotificationBell({ dark = false }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback((force = false) => {
    if (!user) return;
    const promise =
      !force && cache.promise && cache.userId === user.id
        ? cache.promise
        : fetchUnread(user.id);
    promise.then(setUnread);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const onChange = () => refresh(true);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChange);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChange);
  }, [user, refresh]);

  if (!user) return null;

  return (
    <Link
      to={`/${user.role}/notifications`}
      className={`relative p-2 rounded-lg border ${
        dark
          ? "text-white/70 hover:text-white hover:bg-white/10 border-white/20"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-200"
      }`}
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
    >
      <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;
