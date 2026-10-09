import { useState, useEffect } from "react";
import useAuth from "../hooks/useAuth";
import { listNotifications, markRead, markAllRead } from "../services/notifications";
import LoadingScreen from "./LoadingScreen";

function isSystem(n) {
  return n.type === "system";
}

export function SystemBadge() {
  return (
    <span className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-full uppercase border bg-primary/10 border-primary/20 text-primary">
      System
    </span>
  );
}

export function NotificationItem({ n, onMarkRead }) {
  return (
    <div className={`px-4 py-3 border-b border-gray-50 last:border-0 ${!n.is_read ? "bg-primary/5" : ""}`}>
      <p className="text-xs font-medium text-gray-900 flex items-center gap-2">
        {n.title}
        {isSystem(n) && <SystemBadge />}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">{n.message}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
        {!n.is_read && (
          <button onClick={() => onMarkRead(n.id)} className="text-[10px] text-primary hover:underline">Mark read</button>
        )}
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

  useEffect(() => {
    if (!user) return;
    listNotifications(user.id, { unreadOnly })
      .then((rows) => setNotifications(rows || []))
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
      await markAllRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      setError(err.message || "Failed to mark all as read");
    }
  }

  if (loading) return <LoadingScreen />;

  const system = notifications.filter(isSystem);
  const rest = notifications.filter((n) => !isSystem(n));

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-medium">INBOX</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setUnreadOnly((v) => !v); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${unreadOnly ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {unreadOnly ? "Show all" : "Unread only"}
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors"
          >
            Mark all read
          </button>
        </div>
      </header>

      {error && <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">{error}</div>}

      {system.length > 0 && (
        <section className="bg-white border-2 border-primary rounded-2xl shadow-xs overflow-hidden">
          <p className="px-4 py-3 border-b border-gray-100 font-mono text-[10px] tracking-widest text-primary uppercase">System announcements ({system.length})</p>
          {system.map((n) => <NotificationItem key={n.id} n={n} onMarkRead={handleMarkRead} />)}
        </section>
      )}

      <section className="bg-white border-2 border-primary rounded-2xl shadow-xs overflow-hidden">
        {system.length > 0 && (
          <p className="px-4 py-3 border-b border-gray-100 font-mono text-[10px] tracking-widest text-gray-400 uppercase">All other updates ({rest.length})</p>
        )}
        {notifications.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No notifications yet.</p>
        ) : (
          (system.length > 0 ? rest : notifications).map((n) => <NotificationItem key={n.id} n={n} onMarkRead={handleMarkRead} />)
        )}
      </section>
    </div>
  );
}
