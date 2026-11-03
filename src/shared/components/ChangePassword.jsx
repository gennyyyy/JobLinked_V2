import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
    <details className="group profile-panel bg-card border border-primary rounded-lg p-5 md:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
        <span className="border-l-4 border-primary pl-4">
          <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
          <span className="mt-1 block text-xs text-muted-foreground">Use a new password with at least 8 characters.</span>
        </span>
        <span aria-hidden="true" className="text-xl leading-none text-primary transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 border-t border-border pt-5">
        {message && <p className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">{message}</p>}
        {error && <p className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <Input
            type="password"
            required
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
            placeholder="Current password"
            aria-label="Current password"
            className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
          />
          <Input
            type="password"
            required
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
            placeholder="New password"
            aria-label="New password"
            className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
          />
          <Input
            type="password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
          />
          <Button type="submit" disabled={saving} className="min-h-[42px] px-5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60">
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </details>
  );
}

export default ChangePassword;
