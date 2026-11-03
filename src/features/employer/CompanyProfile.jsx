import { useState, useEffect } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile, getEmployer, provision } from "../../shared/services/auth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import ChangePassword from "../../shared/components/ChangePassword";
import { formatFullAddress } from "../../shared/utils/address";
import { buildFullName } from "../../shared/utils/names";
import { titleCase } from "../../shared/utils/titleCase";
import { SANTA_MARIA_BARANGAYS } from "../../shared/constants";

function CompanyProfile() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({});
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    // user.id IS the employers row id — no separate lookup needed
    getEmployer()
      .then((data) => {
        setCompany(data);
        if (data) {
          setForm({
            name: data.company_name || "",
            industry: data.industry || "",
            house_number_unit: data.house_number_unit || "",
            street_address: data.street_address || "",
            subdivision_building: data.subdivision_building || "",
            barangay_district: data.barangay_district || "",
            city_municipality: data.city_municipality || "",
            province_state: data.province_state || "",
            postal_code: data.postal_code || "",
            phone: data.phone || "",
            email: data.email || "",
            company_email: data.company_email || data.email || "",
            website: data.website || "",
            description: data.description || "",
            first_name: data.first_name || "",
            middle_name: data.middle_name || "",
            last_name: data.last_name || "",
            suffix: data.suffix || "",
            representative_email: data.representative_email || "",
            representative_position: data.representative_position || "",
          });
        }
      })
      .catch((err) => setError(err.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // `email` is the login email (auth.users) — read-only here.
      // Everything else maps 1:1 to employers columns.
      const { name, email: _email, ...rest } = form;
      void _email;
      const full_name = buildFullName(rest.first_name, rest.middle_name, rest.last_name, rest.suffix);
      const patch = { ...rest, company_name: name, full_name };

      if (company) {
        // Route through updateProfile so the audit log is written and the
        // update is always pinned to the authenticated user's own row (user.id).
        const updated = await updateProfile(user.id, patch);
        setCompany(updated);
        // Refresh auth context so user.company_name etc. stay current everywhere
        if (refreshUser) await refreshUser(user);
      } else {
        // First login after email-confirmation with no employers row yet:
        // provision it now (server also opens the pending accreditation row).
        const created = await provision({ role: "employer", email: user.email, ...patch });
        setCompany(created);
        if (refreshUser) await refreshUser(user);
      }

      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  // Read directly from the employers row — kept in sync by documents.js
  const accreditationStatus = company?.accreditation_status || "Not Applied";

  // Display-only: title-case the name, force the suffix to ALL CAPS (e.g. Jr -> JR, iii -> III).
  const representativeName = [
    titleCase([form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ")),
    (form.suffix || "").toUpperCase(),
  ].filter(Boolean).join(" ");
  const companyLogo = !logoFailed && typeof company?.logo_path === "string" && company.logo_path ? company.logo_path : null;

  return (
    <div className="w-full space-y-6">
      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">My Profile</h1>

      <section className="flex items-center gap-4 rounded-t-xl bg-navy px-5 py-4 text-white shadow-sm">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-card text-xl font-bold text-primary shadow-md">
          {companyLogo ? (
            <img src={companyLogo} alt={`${form.name || "Company"} logo`} className="h-full w-full object-cover" onError={() => setLogoFailed(true)} />
          ) : (
            <span>{(form.name?.[0] || "C").toUpperCase()}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight">{titleCase(form.name) || "My Company"}</h2>
            <p className="mt-1 line-clamp-2 text-[11px] italic text-white/75">
              {form.description || `${form.industry || "Company profile"} · ${accreditationStatus}`}
            </p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white hover:bg-card/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Edit Profile
            </button>
          )}
        </div>
      </section>

      <div className="profile-panel rounded-b-xl border border-primary/40 bg-card p-4 md:p-5">

        {saved && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            Company profile updated successfully.
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            <section className="bg-muted border border-border rounded-xl p-5 space-y-4 xl:col-span-2">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">Company Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Company Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Industry</label>
                  <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g., Manufacturing, IT, Retail" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Official Company Email</label>
                  <input type="email" value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} placeholder="hr@company.com" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Company Contact No.</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="02-XXXX-XXXX / 0917 123 4567" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Website</label>
                  <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Company Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Brief description of your company..." className="w-full px-4 py-3 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-none" />
              </div>
            </section>
            <section className="bg-muted border border-border rounded-xl p-5 space-y-4">
              <p className="block font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">Business Address</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[["house_number_unit", "House / Building / Unit No.", "e.g. Unit 402 or Bldg 3"], ["street_address", "Street Address & Lot / Block", "Street address"], ["subdivision_building", "Subdivision / Village / Building Name", "Subdivision name"], ["city_municipality", "City / Municipality", "e.g. Santa Maria"], ["province_state", "Province / State", "e.g. Bulacan"], ["postal_code", "Postal Code", "e.g. 3022"]].map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label htmlFor={field} className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">{label}</label>
                    <input id={field} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={placeholder} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="barangay_district" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Barangay / District</label>
                <select
                  id="barangay_district"
                  value={form.barangay_district || ""}
                  onChange={(e) => setForm({ ...form, barangay_district: e.target.value })}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                >
                  <option value="">Select barangay</option>
                  {form.barangay_district && !SANTA_MARIA_BARANGAYS.includes(form.barangay_district) && (
                    <option value={form.barangay_district}>{form.barangay_district}</option>
                  )}
                  {SANTA_MARIA_BARANGAYS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </section>
            <section className="bg-muted border border-border rounded-xl p-5 space-y-4">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">Authorized Representative</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">First Name</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Maria" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Middle Name</label>
                  <input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} placeholder="Santos" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Last Name</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Reyes" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Suffix</label>
                  <input value={form.suffix} onChange={(e) => setForm({ ...form, suffix: e.target.value })} placeholder="Jr., Sr., III" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Designation / Position</label>
                  <input value={form.representative_position} onChange={(e) => setForm({ ...form, representative_position: e.target.value })} placeholder="e.g. HR Manager" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Representative Email</label>
                  <input type="email" value={form.representative_email} onChange={(e) => setForm({ ...form, representative_email: e.target.value })} placeholder="maria@company.com" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5">Login Email (read-only)</label>
                <input value={form.email} disabled className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-muted-foreground cursor-not-allowed" />
              </div>
            </section>
            <div className="xl:col-span-2 flex items-center justify-end gap-3 pt-3">
              <button type="submit" disabled={saving} className="min-h-[42px] px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover active:scale-[0.98] transition-colors disabled:opacity-60">
                {saving ? "Saving…" : "Save Profile"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-[42px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
            <section className="profile-panel rounded-xl border border-primary/30 bg-muted p-4 lg:col-start-1 lg:row-start-1">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Company Details</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 text-sm">
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Company Name</dt>
                  <dd className="mt-1 text-xs text-muted-foreground font-medium">{titleCase(form.name) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Industry</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{form.industry || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Official Company Email</dt>
                  <dd className="mt-1 font-mono text-xs text-muted-foreground break-all">{form.company_email || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Contact No.</dt>
                  <dd className="mt-1 font-mono text-xs text-muted-foreground">{form.phone || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Website</dt>
                  <dd className="mt-1 font-mono text-xs text-muted-foreground break-all">{form.website || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Login Email</dt>
                  <dd className="mt-1 font-mono text-xs text-muted-foreground break-all">{form.email || "Not set"}</dd>
                </div>
                <div className="sm:col-span-2 border-t border-border pt-3">
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Business Address</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {formatFullAddress(form) || "Not set"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="profile-panel rounded-xl border border-primary/30 bg-muted p-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Authorized Representative</p>
              <dl className="grid grid-cols-1 gap-y-4 text-sm">
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Full Name</dt>
                  <dd className="mt-1 text-xs text-muted-foreground font-medium">
                    {representativeName || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Designation / Position</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{titleCase(form.representative_position) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Representative Email</dt>
                  <dd className="mt-1 font-mono text-xs text-muted-foreground break-all">{form.representative_email || "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Representative Mobile</dt>
                  <dd className="mt-1 font-mono text-xs text-muted-foreground">{form.phone || "Not set"}</dd>
                </div>
              </dl>
            </section>
            <div className="lg:col-start-1 lg:row-start-2"><ChangePassword /></div>
          </div>
        )}
      </div>
      {editing && <div className="-mt-2"><ChangePassword /></div>}
    </div>
  );
}

export default CompanyProfile;
