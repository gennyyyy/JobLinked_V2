import { useState, useEffect } from "react";
import { listReferenceData, addReferenceData, removeReferenceData, purgeOldApplications, sendSystemNotification } from "../../shared/services/admin";
import { listNotifications } from "../../shared/services/notifications";
import useAuth from "../../shared/hooks/useAuth";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";

const categoryLabels = { employment_type: "Employment Types", education_level: "Education Levels" };

const inputClass = "flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30";

// System broadcast: title/message/link form → POST admin/system-notifications
// (shows { sent } result); list = notifications/mine filtered type==='system'.
function SystemNotifications() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState([]);

  useEffect(() => {
    if (!user) return;
    listNotifications(user.id)
      .then((rows) => setSent((rows || []).filter((n) => n.type === "system")))
      .catch(() => setSent([]));
  }, [user]);

  async function handleSend(e) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { setError("Title and message are required."); return; }
    setError("");
    setResult("");
    setSending(true);
    try {
      const res = await sendSystemNotification({ title: title.trim(), message: message.trim(), link: link.trim() || null, expires_at: expiresAt || null });
      setResult(`Broadcast sent to ${res?.sent ?? "?"} user(s).`);
      setTitle("");
      setMessage("");
      setLink("");
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
    <section className="bg-white border border-primary rounded-lg p-5">
      <div className="border-l-4 border-primary pl-4 mb-4">
        <h2 className="text-lg font-semibold text-dark-blue">System Notifications</h2>
        <p className="text-xs text-gray-500 mt-1">Broadcast an announcement to all users. Past broadcasts appear below.</p>
      </div>
      <form onSubmit={handleSend} className="space-y-3">
        <div>
          <label htmlFor="sys-title" className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input id="sys-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Job fair on Saturday" className={inputClass} />
        </div>
        <div>
          <label htmlFor="sys-message" className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea id="sys-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement details…" className={inputClass} />
        </div>
        <div>
          <label htmlFor="sys-link" className="block text-xs font-medium text-gray-600 mb-1">Link <span className="text-gray-400 font-normal">(optional)</span></label>
          <input id="sys-link" type="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/jobs" className={inputClass} />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div>
          <label htmlFor="sys-expires" className="block text-xs font-medium text-gray-600 mb-1">Expires <span className="text-gray-400 font-normal">(optional)</span></label>
          <input id="sys-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
        </div>
        {result && <p className="text-xs text-emerald-700">{result}</p>}
        <button type="submit" disabled={sending} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-60">
          {sending ? "Sending…" : "Send Broadcast"}
        </button>
      </form>
      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="font-mono text-[10px] tracking-widest text-gray-400 uppercase mb-2">Recent broadcasts ({sent.length})</p>
        {sent.length === 0 ? (
          <p className="text-xs text-gray-400">No system broadcasts yet.</p>
        ) : (
          <ul className="space-y-2">
            {sent.slice(0, 5).map((n) => (
              <li key={n.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs font-medium text-gray-900">{n.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Settings() {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newValues, setNewValues] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState("");
  useEffect(() => {
    Promise.all(Object.keys(categoryLabels).map((category) => listReferenceData(category)))
      .then(([employment, education]) => setCategories({ employment_type: employment, education_level: education }))
      .catch((err) => setError(err.message || "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  async function handleAddCategory(category) {
    const value = (newValues[category] || "").trim();
    if (!value) return;
    await addReferenceData(category, value);
    const updated = await listReferenceData(category);
    setCategories((prev) => ({ ...prev, [category]: updated }));
    setNewValues((prev) => ({ ...prev, [category]: "" }));
  }

  async function handleRemoveCategory(category, id) {
    await removeReferenceData(id);
    const updated = await listReferenceData(category);
    setCategories((prev) => ({ ...prev, [category]: updated }));
    setConfirmDelete(null);
  }

  async function handlePurge() {
    try {
      const deleted = await purgeOldApplications(12);
      setPurgeMsg(`Purged ${deleted} application(s) older than 12 months.`);
    } catch (err) {
      setPurgeMsg(err.message || "Purge failed");
    } finally {
      setConfirmPurge(false);
    }
  }

  return (
    <div className="space-y-6 bg-gray-50">
      <header>
        <div className="flex items-center gap-3"><div className="w-1 h-6 bg-primary rounded-full" /><p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM SETTINGS</p></div>
        <h1 className="mt-1 font-sans text-2xl font-bold text-dark-blue">System Settings</h1>
        <p className="mt-2 text-sm text-gray-500">Manage platform reference data: employment types and education levels</p>
      </header>
      {Object.entries(categoryLabels).map(([category, label]) => (
        <section key={category} className="bg-white border border-primary rounded-lg p-5">
          <div className="border-l-4 border-primary pl-4 mb-4"><h3 className="text-lg font-semibold text-dark-blue">{label}</h3></div>
          <div className="space-y-2 mb-4">{(categories[category] || []).map((item) => <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span className="text-sm text-gray-700">{item.value}</span><button onClick={() => setConfirmDelete({ category, id: item.id, value: item.value })} className="text-xs text-danger hover:underline">Remove</button></div>)}</div>
          <div className="flex gap-2"><input type="text" value={newValues[category] || ""} onChange={(e) => setNewValues((prev) => ({ ...prev, [category]: e.target.value }))} placeholder={`Add ${label.toLowerCase().replace(/s$/, "")}...`} className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30" /><button onClick={() => handleAddCategory(category)} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">Add</button></div>
        </section>
      ))}
      {confirmDelete && <ConfirmationModal message={`Remove "${confirmDelete.value}"?`} onConfirm={() => handleRemoveCategory(confirmDelete.category, confirmDelete.id)} onCancel={() => setConfirmDelete(null)} confirmLabel="Remove" danger />}
      <SystemNotifications />
      <section className="bg-white border border-primary rounded-lg p-5">
        <div className="border-l-4 border-danger pl-4 mb-4">
          <h3 className="text-lg font-semibold text-dark-blue">Data Lifecycle</h3>
          <p className="text-xs text-gray-500 mt-1">Delete stale applications (12+ months old, excluding Accepted/Placed).</p>
        </div>
        {purgeMsg && <p className="mb-3 text-xs text-gray-600">{purgeMsg}</p>}
        <button onClick={() => setConfirmPurge(true)} className="px-4 py-2.5 text-sm font-medium text-white bg-danger hover:opacity-90 rounded-lg transition-colors">Purge Old Applications</button>
      </section>
      {confirmPurge && <ConfirmationModal message="Permanently delete applications older than 12 months? This cannot be undone." onConfirm={handlePurge} onCancel={() => setConfirmPurge(false)} confirmLabel="Purge" danger />}
    </div>
  );
}

export default Settings;
