import { Button } from "../../components/ui/button";
import { ImagePlus, Settings2, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile, getEmployer, provision } from "../../shared/services/auth";
import { uploadLogo, removeLogo, logoUrl } from "../../shared/services/images";
import { PageSkeleton } from '../../shared/components/Skeletons';
import ChangePassword from "../../shared/components/ChangePassword";
import TabbedProfileLayout from "../../shared/components/TabbedProfileLayout";
import AccountSettings, { PrivacyPanel } from "../../shared/components/AccountSettings";
import MfaPanel from "../../shared/components/MfaPanel";
import { TabsContent } from "../../components/ui/tabs";
import { buildFullName, nameChangeLockHelp } from "../../shared/utils/names";
import { titleCase } from "../../shared/utils/titleCase";
import { formatPhoneDisplay, isValidPhone, normalizePhone, withPrefix } from "../../shared/utils/phone";
import { FIXED_MUNICIPALITY, FIXED_POSTAL_CODE, FIXED_PROVINCE, INDUSTRIES, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import { SelectField, TextField } from "../../shared/components/design";

const COMPANY_FIELDS = [
  ["name", "Company Name", "e.g. Santa Maria Trading"],
];

const CONTACT_FIELDS = [
  ["company_email", "Recruitment Contact Email", "hr@company.com"],
  ["phone", "Business Phone", "917 123 4567"],
];

const ADDRESS_FIELDS = [
  ["house_number_unit", "House / Building / Unit No.", "e.g. Unit 402 or Bldg 3"],
  ["street_address", "Street Address", "Street address & lot / block"],
  ["subdivision_building", "Subdivision / Village / Building", "Subdivision name"],
];

const REPRESENTATIVE_FIELDS = [
  ["first_name", "First Name", "Maria"],
  ["middle_name", "Middle Name", "Santos"],
  ["last_name", "Last Name", "Reyes"],
  ["suffix", "Suffix", "Jr., Sr., III"],
  ["representative_position", "Designation / Position", "e.g. HR Manager"],
  ["representative_phone", "Representative Mobile", "917 123 4567"],
  ["representative_email", "Representative Email", "maria@company.com"],
];

// ADR-058: only these representative fields are the displayed name.
const REPRESENTATIVE_NAME_FIELDS = new Set(["first_name", "middle_name", "last_name", "suffix"]);

// Stored lowercase by the API (LOWERCASE_FIELDS); show title case in edit view.
const TITLE_FIELDS = new Set([
  "name", "house_number_unit", "street_address", "subdivision_building",
  "barangay_district", "city_municipality", "province_state", "postal_code",
  "first_name", "middle_name", "last_name", "suffix",
]);

// Numbers display without the fixed +63 prefix and are validated on blur.
const PHONE_FIELDS = new Set(["phone", "representative_phone"]);
const PHONE_ERROR = "Enter a valid Philippine contact number (e.g. 917 123 4567).";

// Same core requirements as employer registration; these drive the red markers.
const REQUIRED_REPRESENTATIVE_FIELDS = new Set([
  "first_name", "last_name", "representative_position",
  "representative_phone", "representative_email",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Contact-tab keys, so a failed save can open the tab that owns the error.
const CONTACT_KEYS = new Set([
  "company_email", "phone", "street_address",
  "barangay_district", "city_municipality", "province_state", "postal_code",
]);

const COMPANY_PROFILE_TABS = [
  { value: "company", label: "Company", title: "Company details", description: "These details appear alongside your public vacancies." },
  { value: "contact", label: "Contact & location", title: "Contact & location", description: "Where candidates can reach and find your office." },
  { value: "representative", label: "Representative", title: "Authorized representative", description: "The person PESO contacts about this company." },
  { value: "account", label: "Account settings", title: "Account settings", description: "Manage your account preferences, privacy, and password." },
];

const ACCOUNT_SETTINGS_SECTIONS = new Set([
  "account-overview",
  "notification-preferences",
  "privacy",
  "password-settings",
]);

function companyAcronym(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
  return (words[0] || "C").slice(0, 2).toUpperCase();
}

// Legacy logo_path rows may hold local paths or file: URLs; only absolute http(s) images render.
function remoteLogoUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value.trim() : "");
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// ADR-062: the portal serves Santa Maria, Bulacan only, so both address
// dropdowns are fixed. Their form values stay populated for the save payload.
function CompanyProfile() {
  const { user, refreshUser } = useAuth();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState(null);
  // ADR-058: the representative's name fields lock while the target's window is open.
  const nameLockHelp = nameChangeLockHelp(company?.name_changed_at);
  const [form, setForm] = useState({
    city_municipality: FIXED_MUNICIPALITY,
    province_state: FIXED_PROVINCE,
    postal_code: FIXED_POSTAL_CODE,
  });
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState("company");
  const activeTab = ACCOUNT_SETTINGS_SECTIONS.has(hash.slice(1)) ? "account" : tab;
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoStatus, setLogoStatus] = useState("");
  const [logoError, setLogoError] = useState("");
  const [logoActionsOpen, setLogoActionsOpen] = useState(false);
  const logoActionsRef = useRef(null);

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
            name: titleCase(data.company_name),
            industry: data.industry || "",
            house_number_unit: titleCase(data.house_number_unit),
            street_address: titleCase(data.street_address),
            subdivision_building: titleCase(data.subdivision_building),
            barangay_district: titleCase(data.barangay_district),
            city_municipality: FIXED_MUNICIPALITY,
            province_state: FIXED_PROVINCE,
            postal_code: FIXED_POSTAL_CODE,
            phone: data.phone || "",
            email: data.email || "",
            company_email: data.company_email || data.email || "",
            website: data.website || "",
            description: data.description || "",
            first_name: titleCase(data.first_name),
            middle_name: titleCase(data.middle_name),
            last_name: titleCase(data.last_name),
            suffix: titleCase(data.suffix),
            representative_email: data.representative_email || "",
            representative_phone: data.representative_phone || "",
            representative_position: data.representative_position || "",
          });
        }
      })
      .catch((err) => { if (live) setError(err.message || "Failed to load profile") })
      .finally(() => { if (live) setLoading(false) });
    return () => { live = false };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!logoActionsOpen) return undefined;
    function closeOnOutsideClick(event) {
      if (!logoActionsRef.current?.contains(event.target)) setLogoActionsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [logoActionsOpen]);

  if (loading) return <PageSkeleton stats={0} panels={2} />;
  if (error && !company) return <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p>;

  // Parity with employer registration: nothing here is optional except the
  // address extras, middle name/suffix, and website.
  function validate() {
    const next = {};
    const value = (key) => String(form[key] ?? "").trim();
    if (!value("name")) next.name = "Company name is required";
    if (!value("industry")) next.industry = "Industry is required";
    if (!value("company_email")) next.company_email = "Company email is required";
    else if (!EMAIL_RE.test(value("company_email"))) next.company_email = "Invalid email address";
    if (!value("phone")) next.phone = "Contact number is required";
    else if (!isValidPhone(value("phone"))) next.phone = PHONE_ERROR;
    if (!value("street_address")) next.street_address = "Street address is required";
    if (!value("barangay_district")) next.barangay_district = "Barangay / District is required";
    if (!value("city_municipality")) next.city_municipality = "City / Municipality is required";
    if (!value("province_state")) next.province_state = "Province is required";
    if (!value("first_name")) next.first_name = "First name is required";
    if (!value("last_name")) next.last_name = "Last name is required";
    if (!value("representative_position")) next.representative_position = "Position is required";
    if (!value("representative_phone")) next.representative_phone = "Representative mobile is required";
    else if (!isValidPhone(value("representative_phone"))) next.representative_phone = PHONE_ERROR;
    if (!value("representative_email")) next.representative_email = "Representative email is required";
    else if (!EMAIL_RE.test(value("representative_email"))) next.representative_email = "Invalid email address";
    setErrors(next);
    if (Object.keys(next).length) {
      // Show the tab that owns the first error so its message is not hidden.
      setTab(next.name || next.industry ? "company"
        : Object.keys(next).some((key) => CONTACT_KEYS.has(key)) ? "contact"
          : "representative");
    }
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      // `email` is the login email (auth.users) — read-only here.
      // Everything else maps 1:1 to employers columns.
      const { name, email: _email, ...rest } = form;
      void _email;
      const full_name = buildFullName(rest.first_name, rest.middle_name, rest.last_name, rest.suffix);
      const phone = normalizePhone(rest.phone);
      const representative_phone = normalizePhone(rest.representative_phone);
      const patch = { ...rest, company_name: name, full_name, phone, representative_phone };

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

      setForm((previous) => ({ ...previous, phone, representative_phone }));
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

  function openLogoPicker() {
    document.getElementById("company-logo-picker")?.click();
    setLogoActionsOpen(false);
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
      // has_logo/logo_updated_at live on the auth user; refresh so the header
      // image changes without a reload (same pattern as the seeker picture).
      if (refreshUser) await refreshUser(user);
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
      if (refreshUser) await refreshUser(user);
      setLogoStatus("Logo removed.");
      setLogoActionsOpen(false);
    } catch (err) {
      setLogoError(err.message || "Could not remove the logo");
    } finally {
      setLogoBusy(false);
    }
  }

  const companyLogo = !logoFailed && company
    ? (company.has_logo
      ? logoUrl(company.id, company.logo_updated_at)
      : remoteLogoUrl(company.logo_path))
    : null;
  const barangayOptions = [
    ...(!form.barangay_district || SANTA_MARIA_BARANGAYS.includes(form.barangay_district)
      ? []
      : [{ value: form.barangay_district, label: form.barangay_district }]),
    ...SANTA_MARIA_BARANGAYS.map((b) => ({ value: b, label: b })),
  ];
  const field = (name) => ({
    id: name,
    value: PHONE_FIELDS.has(name)
      ? formatPhoneDisplay(form[name])
      : TITLE_FIELDS.has(name) ? titleCase(form[name]) : (form[name] || ""),
    onChange: (e) => {
      const next = PHONE_FIELDS.has(name) ? withPrefix(e.target.value) : e.target.value;
      setForm({ ...form, [name]: next });
      // Keep an existing phone error only while the edited value is still invalid.
      setErrors((previous) => (!PHONE_FIELDS.has(name) || !previous[name] || isValidPhone(next)
        ? { ...previous, [name]: undefined }
        : previous));
    },
    ...(PHONE_FIELDS.has(name) && {
      prefix: "+63",
      inputMode: "numeric",
      onBlur: () => {
        const next = normalizePhone(form[name]);
        setForm((previous) => ({ ...previous, [name]: next }));
        setErrors((previous) => ({ ...previous, [name]: next && !isValidPhone(next) ? PHONE_ERROR : undefined }));
      },
    }),
  });
  function handleTabChange(nextTab) {
    setTab(nextTab);
    if (ACCOUNT_SETTINGS_SECTIONS.has(hash.slice(1))) navigate("/employer/company", { replace: true });
  }

  return (
    <>
      <TabbedProfileLayout
        pageTitle="A good team starts with your story."
        pageDescription="Help candidates understand who you are, what you do, and where they can find you."
        tabs={COMPANY_PROFILE_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSubmit={handleSubmit}
        saving={saving}
        saveLabel="Save company profile"
        savingLabel="Saving…"
        showSave={activeTab !== "account"}
        status={saved ? "Company profile updated successfully." : ""}
        error={error}
        sidebar={<PrivacyPanel />}
      >
        <TabsContent value="company" id="company-details">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <div ref={logoActionsRef} className="group relative size-30 shrink-0">
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {companyLogo ? (
                  <img src={companyLogo} alt="Company logo" className="size-full object-cover" onError={() => setLogoFailed(true)} />
                ) : (
                  <span aria-hidden="true" className="text-3xl font-bold tracking-tight">
                    {companyAcronym(form.name)}
                  </span>
                )}
              </div>
              <div className={`absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-black/50 transition-opacity ${logoActionsOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                {!logoActionsOpen ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Company logo settings"
                    aria-expanded={logoActionsOpen}
                    disabled={logoBusy}
                    className="text-white hover:bg-white/20 hover:text-white"
                    onClick={() => setLogoActionsOpen(true)}
                  >
                    <Settings2 className="size-4" />
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={companyLogo ? "Edit company logo" : "Add company logo"}
                      disabled={logoBusy}
                      className="text-white hover:bg-white/20 hover:text-white"
                      onClick={openLogoPicker}
                    >
                      <ImagePlus className="size-4" />
                    </Button>
                    {companyLogo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove company logo"
                        disabled={logoBusy}
                        className="text-white hover:bg-white/20 hover:text-white"
                        onClick={handleRemoveLogo}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="company-logo-picker" className="text-sm font-semibold text-foreground">Company Logo</label>
              <p className="text-xs leading-5 text-muted-foreground">Upload a logo to appear with your company details and public job listings.</p>
              <input id="company-logo-picker" type="file" accept="image/png,image/jpeg,image/webp" disabled={logoBusy} className="sr-only" aria-label="Upload company logo" onChange={handleLogo} />
              {logoBusy && <p role="status" className="text-xs text-muted-foreground">Uploading…</p>}
              {logoStatus && !logoBusy && <p role="status" className="text-xs font-medium text-success">{logoStatus}</p>}
              {logoError && <p role="alert" className="text-xs text-destructive">{logoError}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMPANY_FIELDS.map(([name, label, placeholder]) => (
              <TextField key={name} label={label} placeholder={placeholder} required error={errors[name]} {...field(name)} />
            ))}
            <SelectField
              label="Industry"
              id="industry"
              placeholder="Select industry"
              options={INDUSTRIES}
              required
              error={errors.industry}
              {...field("industry")}
            />
          </div>
          <div className="mt-4">
              <TextField label="About the Company" multiline rows={5} placeholder="Brief description of your company…" {...field("description")} />
          </div>
          <div className="mt-4">
              <TextField label="Website (Optional)" placeholder="https://…" {...field("website")} />
          </div>
        </TabsContent>
        <TabsContent value="contact" id="contact-location">
            <div className="grid gap-4 sm:grid-cols-2">
              {CONTACT_FIELDS.map(([name, label, placeholder]) => (
                <TextField key={name} label={label} placeholder={placeholder} required type={name === "company_email" ? "email" : name === "phone" ? "tel" : "text"} error={errors[name]} {...field(name)} />
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {ADDRESS_FIELDS.map(([name, label, placeholder]) => (
                <div key={name} className={name === "subdivision_building" ? "sm:col-span-2" : undefined}>
                  <TextField label={label} placeholder={placeholder} required={name === "street_address"} error={errors[name]} {...field(name)} />
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Barangay / District"
                id="barangay_district"
                placeholder="Select barangay"
                options={barangayOptions}
                required
                error={errors.barangay_district}
                {...field("barangay_district")}
              />
              <SelectField
                label="City / Municipality"
                id="city_municipality"
                options={[FIXED_MUNICIPALITY]}
                value={FIXED_MUNICIPALITY}
                disabled
                required
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Province / State"
                id="province_state"
                options={[FIXED_PROVINCE]}
                value={FIXED_PROVINCE}
                disabled
                required
              />
              <TextField label="Postal Code" value={FIXED_POSTAL_CODE} disabled className="form-select disabled:bg-background" />
            </div>
        </TabsContent>
        <TabsContent value="representative" id="authorized-representative">
            <div className="grid gap-4 sm:grid-cols-2">
              {REPRESENTATIVE_FIELDS.map(([name, label, placeholder]) => (
                <TextField
                  key={name}
                  label={label}
                  placeholder={placeholder}
                  type={name === "representative_email" ? "email" : name === "representative_phone" ? "tel" : "text"}
                  required={REQUIRED_REPRESENTATIVE_FIELDS.has(name)}
                  error={errors[name]}
                  disabled={REPRESENTATIVE_NAME_FIELDS.has(name) && Boolean(nameLockHelp)}
                  help={REPRESENTATIVE_NAME_FIELDS.has(name) ? nameLockHelp || undefined : undefined}
                  {...field(name)}
                />
              ))}
            </div>
        </TabsContent>
        <TabsContent value="account">
          <AccountSettings embedded showPrivacy={false}>
            <ChangePassword embedded />
            <MfaPanel />
          </AccountSettings>
        </TabsContent>
      </TabbedProfileLayout>
    </>
  );
}

export default CompanyProfile;
