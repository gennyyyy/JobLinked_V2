import { Button } from "../../components/ui/button";
import { useState } from "react";
import { Panel, TextField } from "./design";
import Flash from "./Flash";
import PasswordRequirements from "./PasswordRequirements";
import useAuth from "../hooks/useAuth";
import { changePassword } from "../services/auth";
import { passwordError } from "../utils/password";

function ChangePassword({ embedded = false }) {
  const { user } = useAuth() || {};
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
    <Panel id="password-settings" title="Credentials" description="Your login email and password." size={embedded ? "sm" : "default"}>
      {message && <Flash className="mb-4">{message}</Flash>}
      {error && <Flash variant="error" className="mb-4">{error}</Flash>}
      <PasswordForm onSubmit={embedded ? undefined : handleSubmit} onKeyDown={handleEmbeddedKeyDown} className={`flex max-w-xl flex-col ${embedded ? "gap-2.5" : "gap-5"}`}>
        <TextField
          label={<span>Login Email <span className="text-xs font-normal text-muted-foreground">(read only)</span></span>}
          name="loginEmail"
          type="email"
          autoComplete="email"
          disabled
          className="disabled:opacity-75 disabled:bg-input/30 disabled:cursor-default"
          help="This is the email you use to sign in. It can't be changed here."
          value={user?.email || ""}
        />
        <TextField
          label="Current Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
        <div>
          <TextField
            label="New Password"
            type="password"
            autoComplete="new-password"
            required
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
          <PasswordRequirements value={form.next} />
        </div>
        <TextField
          label="Confirm New Password"
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
