import { useState } from "react";
import { changePassword } from "../services/auth";

function ChangePassword() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (form.next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      setMessage("Password updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-sm">
      <div className="border-l-4 border-primary pl-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        <p className="text-xs text-gray-500 mt-1">Use a new password with at least 8 characters.</p>
      </div>
      {message && <p className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">{message}</p>}
      {error && <p className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <input
          type="password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
          placeholder="Current password"
          aria-label="Current password"
          className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
        />
        <input
          type="password"
          required
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          placeholder="New password"
          aria-label="New password"
          className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
        />
        <input
          type="password"
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
        />
        <button type="submit" disabled={saving} className="min-h-[42px] px-5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60">
          {saving ? "Updating..." : "Update Password"}
        </button>
      </form>
    </section>
  );
}

export default ChangePassword;
