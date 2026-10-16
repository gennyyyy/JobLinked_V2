import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../../shared/services/auth";
import { EMPLOYMENT_STATUSES, BULACAN_MUNICIPALITIES, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import { mapResumeText } from "../../shared/utils/resumeAutofill";
import { normalizePhone, isValidPhone, withPrefix } from "../../shared/utils/phone";
import { TagInput } from "../../shared/components/TagInput";
import TermsModal from "../../shared/components/TermsModal";
import Logo from "../../assets/TextBased Logo.png";

const EDUCATION_LEVELS = ["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"];
const MAX_PDF_SIZE = 2 * 1024 * 1024;
const MAX_RESUME_SIZE = 5 * 1024 * 1024;

const EMPTY_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  birthdate: "",
  mobileNumber: "",
  email: "",
  password: "",
  confirmPassword: "",
  lot: "",
  block: "",
  streetAddress: "",
  subdivisionBuilding: "",
  barangayDistrict: "",
  cityMunicipality: "",
  provinceState: "",
  postalCode: "",
  employmentStatus: "",
  skills: "",
  agree: false,
  confirmAccurate: false,
};

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [autofillStatus, setAutofillStatus] = useState("");
  // Optional education is stored with signup metadata and provisioned after
  // email verification when a session becomes available.
  const [education, setEducation] = useState({ level: "", school: "", field: "", year: "", studying: false });
  const [eduError, setEduError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const formRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (submitted && !needsConfirmation) {
      const timer = setTimeout(() => navigate('/job-seeker'), 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, needsConfirmation, navigate]);

  // Single setter: updates the field and clears its error once the user edits it.
  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validate(values) {
    const e = {};
    if (!values.firstName?.trim()) e.firstName = "First name is required";
    if (!values.lastName?.trim()) e.lastName = "Last name is required";
    if (!values.email?.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = "Invalid email address";
    if (!values.mobileNumber?.trim()) e.mobileNumber = "Mobile number is required";
    else if (!isValidPhone(values.mobileNumber)) e.mobileNumber = "Enter a valid number (e.g. 917 123 4567)";
    if (!values.birthdate) e.birthdate = "Birthday is required";
    if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
    if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
    if (!values.provinceState?.trim()) e.provinceState = "Province is required";
    if (values.postalCode?.trim() && !/^\d{4}$/.test(values.postalCode.trim())) e.postalCode = "Postal code must be 4 digits";
    if (!values.password) e.password = "Password is required";
    else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!values.employmentStatus) e.employmentStatus = "Employment status is required";
    if (!values.agree) e.agree = "You must agree to the terms";
    if (!values.confirmAccurate) e.confirmAccurate = "Please confirm your information is true and correct";
    return e;
  }

  // Education is optional; when started (level or school filled) both are
  // required, and a non-studying entry needs a 4-digit graduation year.
  function validateEducation(edu) {
    if (!edu.level.trim() && !edu.school.trim()) return "";
    if (!edu.level.trim() || !edu.school.trim()) return "Please select a level and enter a school name.";
    if (!edu.studying && !/^\d{4}$/.test(edu.year.trim())) return "Graduation year must be a 4-digit year.";
    return "";
  }

  // Resume -> form autofill. PDF/DOCX only; anything else stays blank and the
  // user fills it in. Non-empty mapped values merge in, so hand-typed fields
  // the resume didn't cover are preserved.
  async function handleResumeChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setAutofillStatus("Couldn't read this format — upload a PDF or DOCX to autofill.");
      return;
    }
    if (ext === "pdf" && file.size > MAX_PDF_SIZE) {
      setAutofillStatus("PDF files must be 2 MB or smaller.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      setAutofillStatus("DOCX files must be 5 MB or smaller.");
      return;
    }
    setAutofillStatus("Reading your resume…");
    try {
      // pdfjs + mammoth are ~850 kB: load them only when a resume is picked.
      const { extractResumeText } = await import("../../shared/lib/resumeText");
      const mapped = mapResumeText(await extractResumeText(file));
      const skills = Array.isArray(mapped.skills) ? mapped.skills : [];
      const filled = {};
      for (const [key, value] of Object.entries(mapped)) {
        if (key === "skills" || key === "education") continue;
        if (String(value || "").trim()) {
          filled[key] = value;
        }
      }
      const edu = Object.fromEntries(
        Object.entries(mapped.education || {}).filter(([, v]) => String(v || "").trim()),
      );
      setForm((prev) => {
        const merged = {};
        for (const [key, value] of Object.entries(filled)) {
          const pv = prev[key];
          const prevSet = Array.isArray(pv) ? pv.length > 0 : String(pv || "").trim() !== "";
          if (!prevSet) merged[key] = value;
        }
        return {
          ...prev,
          ...merged,
          ...(skills.length
            ? {
              skills: (() => {
                const combined = String(prev.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
                for (const s of skills) {
                  if (!combined.some((t) => t.toLowerCase() === s.toLowerCase())) combined.push(s);
                }
                return combined.join(", ");
              })(),
            }
            : {}),
        };
      });
      if (Object.keys(edu).length) {
        setEducation((prev) => {
          const kept = {};
          for (const [k, v] of Object.entries(edu)) {
            if (!String(prev[k] || "").trim()) kept[k] = v;
          }
          return Object.keys(kept).length ? { ...prev, ...kept } : prev;
        });
      }
      const count = Object.keys(filled).length + (skills.length ? 1 : 0);
      setAutofillStatus(
        count
          ? `Filled ${count} field${count === 1 ? "" : "s"}${skills.length ? ` · ${skills.length} skills found` : ""}${Object.keys(edu).length ? " · highest education added" : ""}.`
          : "Couldn't find any details to fill in — enter them manually.",
      );
    } catch (err) {
      setAutofillStatus(err?.message || "Couldn't read this resume — enter your details manually.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validate(form);
    const eduValidationError = validateEducation(education);
    if (Object.keys(validationErrors).length > 0 || eduValidationError) {
      setErrors(validationErrors);
      setEduError(eduValidationError);
      focusFirstError(firstErrorKey(validationErrors, eduValidationError ? "educationLevel" : null));
      return;
    }
    setErrors({});
    setEduError("");
    setBusy(true);
    setError("");
    try {
      const account = await signUp({
        email: form.email.trim(),
        password: form.password,
        role: "job-seeker",
        firstName: form.firstName.trim(),
        middleName: form.middleName?.trim() || "",
        lastName: form.lastName.trim(),
        suffix: form.suffix?.trim() || "",
        extra: {
          phone: normalizePhone(form.mobileNumber),
          birthdate: form.birthdate,
          lot: form.lot.trim(),
          block: form.block.trim(),
          streetAddress: form.streetAddress.trim(),
          subdivisionBuilding: form.subdivisionBuilding?.trim() || "",
          barangayDistrict: form.barangayDistrict?.trim() || "",
          cityMunicipality: form.cityMunicipality.trim(),
          provinceState: form.provinceState.trim(),
          postalCode: form.postalCode?.trim() || "",
          country: "Philippines",
          employmentStatus: form.employmentStatus || "",
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          education: education.level.trim() && education.school.trim() ? {
            level: education.level.trim(),
            school: education.school.trim(),
            field: education.field.trim() || null,
            end_year: education.studying ? null : Number(education.year.trim()),
          } : null,
        },
      });
      setNeedsConfirmation(!!account.emailConfirmationRequired);
      setSubmittedEmail(account.email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";
  const labelClass = "block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5";
  const reqMark = <span className="text-danger" aria-hidden="true"> *</span>;

  function focusFirstError(key) {
    if (!key) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(key);
      if (!el) return;
      el.style.scrollMarginTop = "";
      el.scrollIntoView?.({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    });
  }

  // First error in visual (DOM) order, so scroll never jumps past an
  // empty field above to a later one (e.g. birthday skipped for email).
  function firstErrorKey(errors, fallbackKey) {
    const formEl = formRef.current;
    if (formEl) {
      for (const el of formEl.querySelectorAll("[id]")) {
        if (errors[el.id]) return el.id;
      }
    }
    return Object.keys(errors)[0] ?? fallbackKey ?? null;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
        <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10">
          <div className="w-full px-4 h-[64px] flex items-center justify-between">
            <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
              <Link to="/"><img src={Logo} alt="JobLinked" width={480} height={160} className="h-10" /></Link>
            </div>
            <span className="hidden sm:block font-mono text-[11px] text-gray-500">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-[3%]">
          <div className="max-w-md w-full text-center bg-white border border-primary rounded-lg p-6 shadow-xl">
            <span className={`font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full border font-semibold ${needsConfirmation ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-600"}`}>
              {needsConfirmation ? "VERIFY YOUR EMAIL" : "ACCOUNT READY"}
            </span>
            <h1 className="mt-4 text-2xl font-bold text-dark-blue">{needsConfirmation ? "Check Your Email" : "Registration Complete!"}</h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              {needsConfirmation
                ? `We sent a verification link to ${submittedEmail || "your email"}. Open it to activate your account, then sign in to the portal.`
                : "Your JobLinked applicant account has been created. You can now log in and apply to verified Santa Maria postings."}
            </p>
            <Link
              to="/job-seeker/login"
              className="inline-flex mt-6 min-h-[44px] items-center justify-center px-8 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
            >
              Sign In to Portal →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10">
        <div className="w-full px-4 h-[64px] flex items-center justify-between">
          <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
            <Link to="/"><img src={Logo} alt="JobLinked" width={480} height={160} className="h-10" /></Link>
          </div>
          <span className="hidden sm:block font-mono text-[11px] text-gray-500">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-[3%]">
        <div className="w-full max-w-4xl bg-white border border-primary rounded-lg p-6 md:p-10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-gray-500 hover:text-primary transition-colors">
              ← Back to roles
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
              JOB SEEKER
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Job Seeker Registration</h1>
            <p className="mt-2 text-sm text-gray-500">Fill in your details to create your verified municipal applicant account</p>
          </header>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 register-form">
            <section className="bg-gray-50 border border-primary rounded-lg p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 1 — Personal Details</p>
              <div className="space-y-4">
            <section className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <label htmlFor="resumeAutofill" className={`${labelClass} text-primary`}>Autofill from resume (PDF or DOCX only)</label>
              <input
                id="resumeAutofill"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeChange}
                className="block w-full text-xs text-gray-500 file:mr-3 file:min-h-[40px] file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold hover:file:bg-primary-hover file:cursor-pointer cursor-pointer"
              />
              <p className="mt-2 text-xs text-gray-500">PDF up to 2 MB or DOCX up to 5 MB. We'll fill in details below; review and edit them before continuing.</p>
              {autofillStatus && (
                <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-primary">{autofillStatus}</p>
              )}
            </section>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="firstName" className={labelClass}>First Name{reqMark}</label>
                <input id="firstName" name="firstName" type="text" placeholder="Juan" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass} />
                {errors.firstName && <p className="text-danger text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="middleName" className={labelClass}>Middle Name <span className="text-gray-500 font-normal">(optional)</span></label>
                <input id="middleName" name="middleName" type="text" placeholder="Santos" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>Last Name{reqMark}</label>
                <input id="lastName" name="lastName" type="text" placeholder="Dela Cruz" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass} />
                {errors.lastName && <p className="text-danger text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="suffix" className={labelClass}>Suffix <span className="text-gray-500 font-normal">(optional)</span></label>
                <input id="suffix" name="suffix" type="text" placeholder="Jr., Sr., III" value={form.suffix} onChange={(e) => set("suffix", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="birthdate" className={labelClass}>Birthday{reqMark}</label>
                <input id="birthdate" name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} className={inputClass} />
                {errors.birthdate && <p className="text-danger text-xs mt-1">{errors.birthdate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="mobileNumber" className={labelClass}>Mobile Number{reqMark}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">+63</span>
                  <input id="mobileNumber" name="mobileNumber" type="tel" inputMode="numeric" maxLength={10} placeholder="917 123 4567" value={form.mobileNumber.replace(/^\+63/, "")} onChange={(e) => set("mobileNumber", withPrefix(e.target.value))} onBlur={(e) => set("mobileNumber", normalizePhone(e.target.value))} className={`${inputClass} pl-12`} />
                </div>
                {errors.mobileNumber && <p className="text-danger text-xs mt-1">{errors.mobileNumber}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email Address{reqMark}</label>
              <input id="email" name="email" type="email" placeholder="juan.delacruz@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="password" className={labelClass}>Password{reqMark}</label>
                <input id="password" name="password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputClass} />
                {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>Confirm Password{reqMark}</label>
                <input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} className={inputClass} />
                {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="employmentStatus" className={labelClass}>Employment Status{reqMark}</label>
              <select id="employmentStatus" name="employmentStatus" value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)} className={inputClass}>
                <option value="">Select status</option>
                {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.employmentStatus && <p className="text-danger text-xs mt-1">{errors.employmentStatus}</p>}
            </div>
              </div>
            </section>

            <section className="bg-gray-50 border border-primary rounded-lg p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Address Information</p>
              <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="lot" className={labelClass}>Lot <span className="text-gray-500 font-normal">(optional)</span></label>
                  <input id="lot" name="lot" type="text" placeholder="e.g. 12" value={form.lot} onChange={(e) => set("lot", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="block" className={labelClass}>Block <span className="text-gray-500 font-normal">(optional)</span></label>
                  <input id="block" name="block" type="text" placeholder="e.g. 4" value={form.block} onChange={(e) => set("block", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="streetAddress" className={labelClass}>Street Address{reqMark}</label>
                  <input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={inputClass} />
                  {errors.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                </div>
                <div>
                  <label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-gray-500 font-normal">(optional)</span></label>
                  <input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" value={form.subdivisionBuilding} onChange={(e) => set("subdivisionBuilding", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="barangayDistrict" className={labelClass}>Barangay / District <span className="text-gray-500 font-normal">(optional)</span></label>
                  <select id="barangayDistrict" name="barangayDistrict" value={form.barangayDistrict} onChange={(e) => set("barangayDistrict", e.target.value)} className={inputClass}>
                    <option value="">Select barangay</option>
                    {form.barangayDistrict && !SANTA_MARIA_BARANGAYS.includes(form.barangayDistrict) && (
                      <option value={form.barangayDistrict}>{form.barangayDistrict}</option>
                    )}
                    {SANTA_MARIA_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="cityMunicipality" className={labelClass}>City / Municipality{reqMark}</label>
                  <select id="cityMunicipality" name="cityMunicipality" value={form.cityMunicipality} onChange={(e) => set("cityMunicipality", e.target.value)} className={inputClass}>
                    <option value="">Select city / municipality</option>
                    {BULACAN_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {errors.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                </div>
                <div>
                  <label htmlFor="provinceState" className={labelClass}>Province / State{reqMark}</label>
                  <select id="provinceState" name="provinceState" value={form.provinceState} onChange={(e) => set("provinceState", e.target.value)} className={inputClass}>
                    <option value="">Select province</option>
                    <option value="Bulacan">Bulacan</option>
                  </select>
                  {errors.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                </div>
                <div>
                  <label htmlFor="postalCode" className={labelClass}>Postal Code <span className="text-gray-500 font-normal">(optional)</span></label>
                  <input id="postalCode" name="postalCode" type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 3022" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputClass} />
                  {errors.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                </div>
              </div>
              </div>
            </section>

            <section className="bg-gray-50 border border-primary rounded-lg p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 3 — Background & Consent</p>
              <div className="space-y-4">
              <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Education History</p>
              <div className="grid grid-cols-1 gap-3">
                <select aria-label="Education level" id="educationLevel" value={education.level} onChange={(e) => setEducation({ ...education, level: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all">
                  <option value="">Education level</option>
                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <input aria-label="School name" placeholder="School name" value={education.school} onChange={(e) => setEducation({ ...education, school: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                <div className="flex gap-2">
                  <input aria-label="Course / field of study" placeholder="Course / field" value={education.field} onChange={(e) => setEducation({ ...education, field: e.target.value })} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                  <input aria-label="Graduation year" placeholder="Year" inputMode="numeric" disabled={education.studying} value={education.year} onChange={(e) => setEducation({ ...education, year: e.target.value })} className="w-20 px-3 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-50" />
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
                <input type="checkbox" checked={education.studying} onChange={(e) => setEducation({ ...education, studying: e.target.checked })} className="accent-primary" />
                Currently studying here
              </label>
              {eduError && <p className="mt-2 text-xs text-danger">{eduError}</p>}
              </div>

              <div>
              <label htmlFor="skills" className={labelClass}>Skills <span className="text-gray-500 font-normal">(optional)</span></label>
              <TagInput id="skills" value={form.skills} onChange={(v) => set("skills", v)} placeholder="Type a skill and press Enter" />
              </div>

              <div>
              <div className="space-y-3">
                <div>
                <div className="flex items-start gap-2.5 text-xs text-gray-500 pt-2">
                  <input id="agree" type="checkbox" name="agree" checked={form.agree} disabled={!termsRead} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5 accent-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" />
                  <div>
                    <label htmlFor="agree" className={!termsRead ? "cursor-not-allowed opacity-70" : "cursor-pointer"}>I agree to the municipal data collection terms and PESO privacy policies.{reqMark}</label>
                    <button type="button" onClick={() => setTermsOpen(true)} className="ml-1 whitespace-nowrap text-primary hover:underline underline-offset-4">View terms</button>
                    {!termsRead && <p className="mt-1 text-gray-500">Please open and read the terms before agreeing.</p>}
                  </div>
                </div>
                {errors.agree && <p className="text-danger text-xs mt-1">{errors.agree}</p>}
                </div>

                <div>
                <label className="flex items-start gap-2.5 text-xs text-gray-500 select-none cursor-pointer">
                  <input type="checkbox" id="confirmAccurate" name="confirmAccurate" checked={form.confirmAccurate} onChange={(e) => set("confirmAccurate", e.target.checked)} className="mt-0.5 accent-primary" />
                  <span>I confirm that all the information I provided is true and correct to the best of my knowledge.{reqMark}</span>
                </label>
                {errors.confirmAccurate && <p className="text-danger text-xs mt-1">{errors.confirmAccurate}</p>}
                </div>
              </div>
              </div>
              </div>
            </section>

            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500">
            Already registered?{" "}
            <Link to="/job-seeker/login" className="text-primary hover:underline underline-offset-4 font-medium">
              Log in here
            </Link>
          </p>
        </div>
      </main>

      <footer className="bg-dark-blue text-white">
        <div className="w-full px-4 py-3 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/80 font-medium">
            Job<span className="text-accent">Linked</span> <span className="text-white/50">PESO</span>
          </span>
          <span className="text-white/50">Santa Maria Municipal Hall · hello@joblinked.ph</span>
          <span className="text-white/50">© 2026</span>
        </div>
      </footer>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onRead={() => setTermsRead(true)} />
    </div>
  );
}

export default JobSeekerRegister;
