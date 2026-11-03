import { useState, useEffect } from "react";
import { sendSystemNotification } from "../../shared/services/admin";
import { listNotifications } from "../../shared/services/notifications";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";

const inputClass = "w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30";

export default function Broadcast() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("compose");

  useEffect(() => {
    if (!user) return;
    listNotifications(user.id)
      .then((rows) => {
        setSent((rows || []).filter((n) => n.type === "system"));
        setLoading(false);
      })
      .catch(() => {
        setSent([]);
        setLoading(false);
      });
  }, [user]);

  async function handleSend(e) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { setError("Title and message are required."); return; }
    setError("");
    setResult("");
    setSending(true);
    try {
      const res = await sendSystemNotification({ title: title.trim(), message: message.trim(), expires_at: expiresAt || null });
      setResult(`Broadcast sent to ${res?.sent ?? "?"} user(s).`);
      setTitle("");
      setMessage("");
      setExpiresAt("");
      try {
        const rows = await listNotifications(user.id);
        setSent((rows || []).filter((n) => n.type === "system"));
      } catch { /* list refresh is best-effort */ }
    } catch (err) {
      setError(err.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 bg-gray-50">
      <header>
        <div className="flex items-center gap-3"><div className="w-1 h-6 bg-primary rounded-full" /><p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM BROADCAST</p></div>
        <h1 className="mt-1 font-sans text-2xl font-bold text-dark-blue">Broadcast</h1>
        <p className="mt-2 text-sm text-gray-500">Send an announcement to all users. Past broadcasts appear below.</p>
      </header>
      <div aria-label="Broadcast sections" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("compose")}
          aria-current={tab === "compose" ? "true" : undefined}
          className={tab === "compose"
            ? "rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
            : "rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"}
        >
          Compose
        </button>
        <button
          type="button"
          onClick={() => setTab("recent")}
          aria-current={tab === "recent" ? "true" : undefined}
          className={tab === "recent"
            ? "rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
            : "rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"}
        >
          {`Recent broadcasts (${sent.length})`}
        </button>
      </div>
      {tab === "compose" ? (
        <section className="bg-white border border-primary rounded-lg p-6">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label htmlFor="sys-title" className="block text-xs font-medium text-gray-600 mb-1.5">Title</label>
              <input id="sys-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Job fair on Saturday" className={inputClass} />
            </div>
            <div>
              <label htmlFor="sys-message" className="block text-xs font-medium text-gray-600 mb-1.5">Message</label>
              <textarea id="sys-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement details…" className={`${inputClass} resize-none`} />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div>
              <label htmlFor="sys-expires" className="block text-xs font-medium text-gray-600 mb-1.5">Expires <span className="text-gray-500 font-normal">(optional)</span></label>
              <input id="sys-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
            </div>
            {result && <p className="text-xs text-emerald-700">{result}</p>}
            <div className="flex justify-end pt-1">
              <button type="submit" disabled={sending} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-60">
                {sending ? "Sending…" : "Send Broadcast"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="bg-white border border-primary rounded-lg p-6">
          <div className="border-l-4 border-primary pl-4 mb-5">
            <h2 className="text-lg font-semibold text-dark-blue">Recent broadcasts</h2>
            <p className="text-xs text-gray-500 mt-1.5">Announcements sent to all users.</p>
          </div>
          {loading ? (
            <LoadingScreen />
          ) : sent.length === 0 ? (
            <p className="text-xs text-gray-500">No system broadcasts yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {sent.slice(0, 5).map((n) => (
                <li key={n.id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-xs font-medium text-gray-900">{n.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
