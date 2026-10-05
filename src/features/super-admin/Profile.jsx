import { useState } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile } from "../../shared/services/auth";
import ChangePassword from "../../shared/components/ChangePassword";

function Profile() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: user?.first_name || "", lastName: user?.last_name || "", phone: user?.phone || "" });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateProfile(user.id, { first_name: form.firstName, last_name: form.lastName, full_name: `${form.firstName} ${form.lastName}`.trim(), phone: form.phone });
      await refreshUser(user);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">ACCOUNT PROFILE</p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">My Profile</h1>
        <p className="mt-2 text-sm text-gray-500">Your super administrator account information</p>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-7 shadow-sm border-t-4 border-primary">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary">
            {(user?.full_name || "SA").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
          <h2 className="text-lg font-semibold text-gray-900">{user?.full_name || "Super Administrator"}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <dl className="mt-7 grid grid-cols-1 gap-5 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <div>
            <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Role</dt>
            <dd className="mt-1 text-sm text-gray-700">Super Administrator</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Account Status</dt>
            <dd className="mt-1 text-sm text-emerald-700 capitalize">{user?.status || "Active"}</dd>
          </div>
        </dl>
        {error && <p className="mt-4 text-xs text-danger">{error}</p>}
        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200" />
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200" />
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-60">{saving ? "Saving..." : "Save Profile"}</button>
              <button type="button" onClick={() => setEditing(false)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold">Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="mt-6 px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-50">Edit Profile</button>
        )}
      </section>

      <ChangePassword />
    </div>
  );
}

export default Profile;
