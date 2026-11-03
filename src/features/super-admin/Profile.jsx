import { useState } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile } from "../../shared/services/auth";
import ChangePassword from "../../shared/components/ChangePassword";

function Profile() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: user?.first_name || "", lastName: user?.last_name || "" });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateProfile(user.id, { first_name: form.firstName, last_name: form.lastName, full_name: `${form.firstName} ${form.lastName}`.trim() });
      await refreshUser(user);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const fullName = `${form.firstName} ${form.lastName}`.trim() || user?.full_name || "Super Administrator";
  const initials = fullName.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="w-full space-y-4">
      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">My Profile</h1>

      <section className="flex items-center gap-4 rounded-t-xl bg-dark-blue px-5 py-4 text-white shadow-sm">
        <div aria-label={`${initials} profile initials`} className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-white bg-white text-xl font-bold text-primary shadow-md">
          {initials || "SA"}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight">{fullName}</h2>
            <p className="mt-1 truncate font-mono text-[11px] text-white/70">Super Administrator · {user?.email}</p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Edit Profile
            </button>
          )}
        </div>
      </section>

      <section className="profile-panel rounded-b-xl border border-primary/40 bg-white p-4 md:p-5">
        <dl className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Role</dt>
            <dd className="mt-1 text-sm text-gray-700">Super Administrator</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Account Status</dt>
            <dd className="mt-1 text-sm text-emerald-700 capitalize">{user?.status || "Active"}</dd>
          </div>
        </dl>
        {error && <p className="mt-4 text-xs text-danger">{error}</p>}
        {editing && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200" />
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200" />
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-60">{saving ? "Saving..." : "Save Profile"}</button>
              <button type="button" onClick={() => setEditing(false)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold">Cancel</button>
            </div>
          </form>
        )}
      </section>

      <ChangePassword />
    </div>
  );
}

export default Profile;
