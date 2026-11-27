import { Button } from "../../components/ui/button";
import { useState } from "react";
import { Panel } from "./design";
import { revokeAllSessions } from "../services/account";

function SessionsPanel() {
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSignOutAll() {
    setRevoking(true);
    setMessage("");
    setError("");
    try {
      await revokeAllSessions();
      setMessage("Signed out of all devices.");
    } catch (err) {
      setError(err?.message || "Failed to sign out all devices.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Panel id="sessions" title="Sessions" description="Sign out every active device.">
      <p className="text-xs text-muted-foreground">If you think your account is compromised, revoke all sessions and sign back in.</p>
      <Button type="button" variant="outline" className="mt-3" disabled={revoking} onClick={handleSignOutAll}>
        {revoking ? "Signing out…" : "Sign out all devices"}
      </Button>
      {message && <p role="status" className="mt-3 text-xs text-success">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    </Panel>
  );
}

export default SessionsPanel;
