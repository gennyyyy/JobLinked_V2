import { useState } from "react";
import AuthContext from "./AuthContext";

const VALID_ROLES = ["super-admin", "employer", "job-seeker"];

function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem("joblinked_session");
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed && parsed.role && VALID_ROLES.includes(parsed.role) ? parsed : null;
    } catch {
      return null;
    }
  });

  function login(newRole, user) {
    const next = { role: newRole, email: user?.email || null, name: user?.name || null };
    setSession(next);
    localStorage.setItem("joblinked_session", JSON.stringify(next));
  }

  function logout() {
    setSession(null);
    localStorage.removeItem("joblinked_session");
  }

  const value = {
    role: session?.role || null,
    user: session,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
