import { Button } from "../../components/ui/button";
import { Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile, getEmployer, provision } from "../../shared/services/auth";
import { uploadLogo, removeLogo, logoUrl } from "../../shared/services/images";
import { PageSkeleton } from '../../shared/components/Skeletons';
import ChangePassword from "../../shared/components/ChangePassword";
import TabbedProfileLayout from "../../shared/components/TabbedProfileLayout";
import { TabsContent } from "../../components/ui/tabs";
import { buildFullName } from "../../shared/utils/names";
import { titleCase } from "../../shared/utils/titleCase";
import { SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import { CompanyMark, Panel, SelectField, StatusBadge, TextField } from "../../shared/components/design";

const COMPANY_FIELDS = [
  ["name", "Company name", "e.g. Santa Maria Trading"],
  ["industry", "Industry", "e.g. Manufacturing, IT, Retail"],
];

const CONTACT_FIELDS = [
  ["company_email", "Recruitment contact email", "hr@company.com"],
  ["phone", "Business phone", "02-XXXX-XXXX / 0917 123 4567"],
];

const ADDRESS_FIELDS = [
  ["house_number_unit", "House / Building / Unit No.", "e.g. Unit 402 or Bldg 3"],
  ["street_address", "Street address", "Street address & lot / block"],
  ["subdivision_building", "Subdivision / Village / Building", "Subdivision name"],
  ["city_municipality", "City / Municipality", "e.g. Santa Maria"],
  ["province_state", "Province / State", "e.g. Bulacan"],
  ["postal_code", "Postal Code", "e.g. 3022"],
];

const REPRESENTATIVE_FIELDS = [
  ["first_name", "First Name", "Maria"],
  ["middle_name", "Middle Name", "Santos"],
  ["last_name", "Last Name", "Reyes"],
  ["suffix", "Suffix", "Jr., Sr., III"],
  ["representative_position", "Designation / Position", "e.g. HR Manager"],
  ["representative_email", "Representative Email", "maria@company.com"],
];

const COMPANY_PROFILE_TABS = [
  { value: "company", label: "Company", title: "Company details", description: "These details appear alongside your public vacancies." },
  { value: "contact", label: "Contact & location", title: "Contact & location", description: "Where candidates can reach and find your office." },
  { value: "representative", label: "Representative", title: "Authorized representative", description: "The person PESO contacts about this company." },
];

function CompanyProfile() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({});
  const [tab, setTab] = useState("company");
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoStatus, setLogoStatus] = useState("");
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    if (!user) return;
    let live = true;
    Promise.resolve().then(() => { if (live) setLoading(true) });
    getEmployer()
      .then((data) => {
        if (!live) return;
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
      .catch((err) => { if (live) setError(err.message || "Failed to load profile") })
      .finally(() => { if (live) setLoading(false) });
    return () => { live = false };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton stats={0} panels={2} />;
  if (error && !company) return <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p>;

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

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function refreshCompany() {
    const data = await getEmployer();
    setCompany(data);
    setLogoFailed(false);
    return data;
  }

  async function handleLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoError("");
    setLogoStatus("");
    setLogoBusy(true);
    try {
      await uploadLogo(file); // resized client-side, bytes persisted in Postgres
      await refreshCompany();
      setLogoStatus("Logo saved.");
    } catch (err) {
      setLogoError(err.message || "Could not save the logo");
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleRemoveLogo() {
    setLogoError("");
    setLogoStatus("");
    setLogoBusy(true);
    try {
      await removeLogo();
      await refreshCompany();
      setLogoStatus("Logo removed.");
    } catch (err) {
      setLogoError(err.message || "Could not remove the logo");
    } finally {
      setLogoBusy(false);
    }
  }

  // Read directly from the employers row — kept in sync by documents.js
  const accreditationStatus = company?.accreditation_status || "Not Applied";

  // Display-only: title-case the name, force the suffix to ALL CAPS (e.g. Jr -> JR, iii -> III).
  const representativeName = [
    titleCase([form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ")),
    (form.suffix || "").toUpperCase(),
  ].filter(Boolean).join(" ");
  const companyLogo = !logoFailed && company
    ? (company.has_logo
      ? logoUrl(company.id, company.logo_updated_at)
      : (typeof company.logo_path === "string" && company.logo_path ? company.logo_path : null))
    : null;
  const barangayOptions = [
    ...(!form.barangay_district || SANTA_MARIA_BARANGAYS.includes(form.barangay_district)
      ? []
      : [{ value: form.barangay_district, label: form.barangay_district }]),
    ...SANTA_MARIA_BARANGAYS.map((b) => ({ value: b, label: b })),
  ];
  const field = (name) => ({
    id: name,
    value: form[name] || "",
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });

  return (
    <>
      <TabbedProfileLayout
        pageTitle="A good team starts with your story."
        pageDescription="Help candidates understand who you are, what you do, and where they can find you."
        tabs={COMPANY_PROFILE_TABS}
        activeTab={tab}
        onTabChange={setTab}
        onSubmit={handleSubmit}
        saving={saving}
        saveLabel="Save company profile"
        savingLabel="Saving…"
        status={saved ? "Company profile updated successfully." : ""}
        error={error}
        sidebar={(
          <Panel title="Your company at a glance">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={`${form.name || "Company"} logo`}
                data-testid="company-logo-image"
                loading="lazy"
                decoding="async"
                className="size-16 rounded-2xl border object-cover"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <CompanyMark initials={(form.name?.[0] || "C").toUpperCase()} large />
            )}
            <h2 className="mt-4 text-base font-semibold text-navy">{titleCase(form.name) || "My Company"}</h2>
            <p className="my-3 text-xs leading-6 text-muted-foreground">
              {[form.industry || "Company profile", form.barangay_district].filter(Boolean).join(" · ")}
            </p>
            <StatusBadge status={accreditationStatus} />
            {company && (
              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                <label htmlFor="company-logo" className="text-xs font-semibold text-navy">Company logo</label>
                <input
                  id="company-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={logoBusy}
                  onChange={handleLogo}
                  className="block w-full text-[11px] text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                />
                <div className="flex flex-wrap items-center gap-3">
                  {company.has_logo && (
                    <Button type="button" variant="outline" size="sm" onClick={handleRemoveLogo} disabled={logoBusy}>
                      <Trash2 data-icon="inline-start" />Remove logo
                    </Button>
                  )}
                  {logoBusy && <span role="status" className="text-[11px] text-muted-foreground">Uploading…</span>}
                  {logoStatus && !logoBusy && <span role="status" className="text-[11px] font-medium text-success">{logoStatus}</span>}
                </div>
                {logoError && <p role="alert" className="text-[11px] text-destructive">{logoError}</p>}
              </div>
            )}
            <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
              Authorized representative: {representativeName || "Not set"}. Editing your profile does not replace the accreditation review.
            </p>
          </Panel>
        )}
      >
        <TabsContent value="company" id="company-details">
          <div className="grid gap-5 sm:grid-cols-2">
            {COMPANY_FIELDS.map(([name, label, placeholder]) => (
              <TextField key={name} label={label} placeholder={placeholder} required {...field(name)} />
            ))}
          </div>
          <div className="mt-5">
              <TextField label="About the company" multiline rows={5} required placeholder="Brief description of your company…" {...field("description")} />
          </div>
          <div className="mt-5">
              <TextField label="Website (optional)" placeholder="https://…" {...field("website")} />
          </div>
        </TabsContent>
        <TabsContent value="contact" id="contact-location">
            <div className="grid gap-5 sm:grid-cols-2">
              {CONTACT_FIELDS.map(([name, label, placeholder]) => (
                <TextField key={name} label={label} placeholder={placeholder} required type={name === "company_email" ? "email" : "text"} {...field(name)} />
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {ADDRESS_FIELDS.map(([name, label, placeholder]) => (
                <TextField key={name} label={label} placeholder={placeholder} required={name === "street_address"} {...field(name)} />
              ))}
            </div>
            <div className="mt-5">
              <SelectField
                label="Barangay / District"
                id="barangay_district"
                placeholder="Select barangay"
                options={barangayOptions}
                {...field("barangay_district")}
              />
            </div>
        </TabsContent>
        <TabsContent value="representative" id="authorized-representative">
            <div className="grid gap-5 sm:grid-cols-2">
              {REPRESENTATIVE_FIELDS.map(([name, label, placeholder]) => (
                <TextField
                  key={name}
                  label={label}
                  placeholder={placeholder}
                  type={name === "representative_email" ? "email" : "text"}
                  {...field(name)}
                />
              ))}
            </div>
            <div className="mt-5">
              <TextField label="Login Email (read-only)" value={form.email || ""} disabled />
            </div>
        </TabsContent>
      </TabbedProfileLayout>

      <div className="mt-6"><ChangePassword /></div>
    </>
  );
}

export default CompanyProfile;
