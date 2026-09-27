import { useState, useEffect } from "react";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { listAccreditations } from "../../services/documents";
import LoadingScreen from "../../components/LoadingScreen";
import ChangePassword from "../../components/ChangePassword";

function CompanyProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState(null);
  const [accreditation, setAccreditation] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!user) return;
    supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle()
      .then(({ data, error: err }) => {
        if (err) throw err;
        setCompany(data);
        if (data) {
          setForm({
            name: data.name || "",
            industry: data.industry || "",
            address: data.address || "",
            phone: data.phone || "",
            website: data.website || "",
            description: data.description || "",
          });
          return listAccreditations(data.id);
        }
        return [];
      })
      .then((accs) => setAccreditation(accs[0] || null))
      .catch((err) => setError(err.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.from("companies").update({ ...form, updated_at: new Date().toISOString() }).eq("id", company.id);
      if (err) throw err;
      setCompany({ ...company, ...form });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const accreditationStatus = accreditation?.status || "Not Applied";

  return (
    <div className="max-w-3xl animate-fade-in space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">COMPANY PROFILE</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Business Information</h1>
        <p className="mt-2 text-sm text-gray-500">Your company details visible to PESO and job seekers</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center font-bold text-xl text-primary">
              {form.name?.[0] || "C"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{form.name || "My Company"}</h2>
              <p className="font-mono text-xs text-gray-400 mt-0.5">
                Accreditation:{" "}
                <span className={accreditationStatus === "approved" ? "text-emerald-600" : accreditationStatus === "rejected" ? "text-danger" : "text-amber-700"}>
                  {accreditationStatus}
                </span>
              </p>
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="min-h-[40px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-900 hover:bg-gray-100 hover:border-primary/40 transition-colors self-start sm:self-center">
              Edit Profile
            </button>
          )}
        </div>

        {saved && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium animate-fade-in">
            Company profile updated successfully.
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Company Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Industry</label>
                <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g., Manufacturing, IT, Retail" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="02-XXXX-XXXX" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Website</label>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Business Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Complete business address" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Company Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Brief description of your company..." className="w-full px-4 py-3 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-none" />
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button type="submit" disabled={saving} className="min-h-[42px] px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover active:scale-[0.98] transition-colors disabled:opacity-60">
                {saving ? "Saving…" : "Save Profile"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-[42px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm p-5 rounded-xl bg-gray-50 border border-gray-200">
            <div>
              <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Industry</dt>
              <dd className="mt-1 text-xs text-gray-700">{form.industry || "Not set"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Phone</dt>
              <dd className="mt-1 font-mono text-xs text-gray-700">{form.phone || "Not set"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Website</dt>
              <dd className="mt-1 text-xs text-gray-700">{form.website || "Not set"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Address</dt>
              <dd className="mt-1 text-xs text-gray-700">{form.address || "Not set"}</dd>
            </div>
            {form.description && (
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Description</dt>
                <dd className="mt-1 text-xs text-gray-600">{form.description}</dd>
              </div>
            )}
          </div>
        )}
      </div>
      <ChangePassword />
    </div>
  );
}

export default CompanyProfile;
