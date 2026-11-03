import { Button } from "../../components/ui/button";
import { useState, useEffect } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile, getEmployer, provision } from "../../shared/services/auth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import ChangePassword from "../../shared/components/ChangePassword";
import { formatFullAddress } from "../../shared/utils/address";
import { buildFullName } from "../../shared/utils/names";
import { titleCase } from "../../shared/utils/titleCase";
import { SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import { CompanyMark, PageHeading, Panel, SelectField, StatusBadge, TextField } from "../../shared/components/design";

const COMPANY_FIELDS = [
  ["name", "Company Name", "e.g. Santa Maria Trading"],
  ["industry", "Industry", "e.g. Manufacturing, IT, Retail"],
  ["company_email", "Official Company Email", "hr@company.com"],
  ["phone", "Company Contact No.", "02-XXXX-XXXX / 0917 123 4567"],
  ["website", "Website", "https://..."],
];

const ADDRESS_FIELDS = [
  ["house_number_unit", "House / Building / Unit No.", "e.g. Unit 402 or Bldg 3"],
  ["street_address", "Street Address & Lot / Block", "Street address"],
  ["subdivision_building", "Subdivision / Village / Building Name", "Subdivision name"],
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

// Label/value pair used by the read-only panels.
function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-xs text-navy">{children || "Not set"}</dd>
    </div>
  );
}

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
  if (error) return <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p>;

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
      <PageHeading
        eyebrow="Employer profile"
        title="My Profile"
        description="Keep your company details and authorized representative current — they appear on your accreditation record."
        action={
          !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          ) : null
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          {saved && (
            <p role="status" className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-xs font-medium text-success">
              Company profile updated successfully.
            </p>
          )}

          {editing ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <Panel title="Company details" description="Shown alongside your public vacancies.">
                <div className="grid gap-5 sm:grid-cols-2">
                  {COMPANY_FIELDS.map(([name, label, placeholder]) => (
                    <TextField key={name} label={label} placeholder={placeholder} type={name === "company_email" ? "email" : "text"} {...field(name)} />
                  ))}
                </div>
                <div className="mt-5">
                  <TextField label="Company Description" multiline rows={4} placeholder="Brief description of your company..." {...field("description")} />
                </div>
              </Panel>

              <Panel title="Business address" description="Where candidates can find your office.">
                <div className="grid gap-5 sm:grid-cols-2">
                  {ADDRESS_FIELDS.map(([name, label, placeholder]) => (
                    <TextField key={name} label={label} placeholder={placeholder} {...field(name)} />
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
              </Panel>

              <Panel title="Authorized representative" description="The person PESO contacts about this company.">
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
              </Panel>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Profile"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Panel title="Company details" description="These details appear alongside your public vacancies.">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Detail label="Company Name">{titleCase(form.name)}</Detail>
                  <Detail label="Industry">{form.industry}</Detail>
                  <Detail label="Official Company Email">{form.company_email}</Detail>
                  <Detail label="Contact No.">{form.phone}</Detail>
                  <Detail label="Website">{form.website}</Detail>
                  <Detail label="Login Email">{form.email}</Detail>
                  <Detail label="Business Address">{formatFullAddress(form)}</Detail>
                </dl>
              </Panel>

              <Panel title="Authorized representative" description="Employer contact on record with PESO.">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Detail label="Full Name">{representativeName}</Detail>
                  <Detail label="Designation / Position">{titleCase(form.representative_position)}</Detail>
                  <Detail label="Representative Email">{form.representative_email}</Detail>
                  <Detail label="Representative Mobile">{form.phone}</Detail>
                </dl>
              </Panel>

              <ChangePassword />
            </>
          )}
        </div>

        <Panel title="Your company at a glance">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={`${form.name || "Company"} logo`}
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
          <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
            Authorized representative: {representativeName || "Not set"}. Editing your profile does not replace the accreditation review.
          </p>
        </Panel>
      </div>

      {editing && <div className="mt-6"><ChangePassword /></div>}
    </>
  );
}

export default CompanyProfile;
