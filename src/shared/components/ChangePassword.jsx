import { Button } from "../../components/ui/button";
import { useState } from "react";
import { Panel, TextField } from "./design";
import { changePassword } from "../services/auth";
import { passwordError, PASSWORD_HINT } from "../utils/password";

function ChangePassword({ embedded = false }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const PasswordForm = embedded ? "div" : "form";

  async function handleSubmit(event) {
    event?.preventDefault?.();
    setMessage("");
    setError("");
    const passwordIssue = passwordError(form.next);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      // BA verifies the current password itself and is not captcha-protected
      // (ADR-056 decision 6), so no token rides along.
      await changePassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      setMessage("Password updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  function handleEmbeddedKeyDown(event) {
    if (embedded && event.key === "Enter" && event.target.tagName === "INPUT") {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Panel id="password-settings" title="Password settings" description={PASSWORD_HINT}>
      {message && <p className="mb-4 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs text-destructive">{error}</p>}
      <PasswordForm onSubmit={embedded ? undefined : handleSubmit} onKeyDown={handleEmbeddedKeyDown} className="flex max-w-xl flex-col gap-5">
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
        <Button type={embedded ? "button" : "submit"} onClick={embedded ? () => handleSubmit() : undefined} disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </Button>
      </PasswordForm>
    </Panel>
  );
}

export default ChangePassword;
