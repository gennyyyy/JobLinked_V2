import { Button } from "../../components/ui/button";
import { useState } from "react";
import { Panel, TextField } from "./design";
import { changePassword } from "../services/auth";
import useCaptcha from "../hooks/useCaptcha";
import Turnstile from "./Turnstile";

function ChangePassword() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const captcha = useCaptcha();

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
    if (captcha.required && !captcha.token) {
      setError("Please complete the verification challenge.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.current, form.next, captcha.token);
      setForm({ current: "", next: "", confirm: "" });
      setMessage("Password updated successfully.");
    } catch (err) {
      captcha.reset(); // single-use token: the next attempt needs a fresh one
      setError(err.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel id="password-settings" title="Password settings" description="Use a new password with at least 8 characters.">
      {message && <p className="mb-4 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs text-destructive">{error}</p>}
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}
        <Button type="submit" disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Panel>
  );
}

export default ChangePassword;
