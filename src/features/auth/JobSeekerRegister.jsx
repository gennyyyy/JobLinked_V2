import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../../shared/services/auth";
import { extractResumeText } from "../../shared/lib/resumeText";
import { mapResumeText } from "../../shared/utils/resumeAutofill";
import { TagInput } from "../../shared/components/TagInput";
import Logo from "../../assets/TextBased Logo.png";

const EDUCATION_LEVELS = ["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"];

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
  houseNumberUnit: "",
  streetAddress: "",
  subdivisionBuilding: "",
  barangayDistrict: "",
  cityMunicipality: "",
  provinceState: "",
  postalCode: "",
  country: "Philippines",
  skills: "",
  agree: false,
};

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [autofillStatus, setAutofillStatus] = useState("");
  // Prefilled from the resume for review; education is entered in Profile after
  // signing in, so it stays out of the signUp payload.
  const [education, setEducation] = useState({ level: "", school: "", field: "", year: "" });
  const [submitted, setSubmitted] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!values.birthdate) e.birthdate = "Birthday is required";
    if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
    if (!values.barangayDistrict) e.barangayDistrict = "Barangay is required";
    if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
    if (!values.provinceState?.trim()) e.provinceState = "Province / State is required";
    if (!values.postalCode?.trim()) e.postalCode = "Postal code is required";
    if (!values.password) e.password = "Password is required";
    else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!values.agree) e.agree = "You must agree to the terms";
    return e;
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
    setAutofillStatus("Reading your resume…");
    try {
      const mapped = mapResumeText(await extractResumeText(file));
      const skills = Array.isArray(mapped.skills) ? mapped.skills : [];
      const filled = {};
      for (const [key, value] of Object.entries(mapped)) {
        if (key === "skills" || key === "education") continue;
        if (String(value || "").trim()) filled[key] = value;
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
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
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
          phone: form.mobileNumber.trim(),
          birthdate: form.birthdate,
          houseNumberUnit: form.houseNumberUnit?.trim() || "",
          streetAddress: form.streetAddress.trim(),
          subdivisionBuilding: form.subdivisionBuilding?.trim() || "",
          barangayDistrict: form.barangayDistrict,
          cityMunicipality: form.cityMunicipality.trim(),
          provinceState: form.provinceState.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
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

  const inputClass = "w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";
  const labelClass = "block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5";

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
        <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10 shadow-sm">
          <div className="w-full px-4 h-[64px] flex items-center justify-between">
            <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
              <Link to="/"><img src={Logo} alt="JobLinked" className="h-10" /></Link>
            </div>
            <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-[3%]">
          <div className="max-w-md w-full text-center bg-white border-2 border-primary rounded-2xl p-8 shadow-xl animate-fade-in">
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
      <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10 shadow-sm">
        <div className="w-full px-4 h-[64px] flex items-center justify-between">
          <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
          <Link to="/"><img src={Logo} alt="JobLinked" className="h-10" /></Link>
        </div>
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-[3%]">
        <div className="w-full max-w-xl bg-white border-2 border-primary rounded-2xl p-7 md:p-9 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-gray-400 hover:text-primary transition-colors">
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

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <section className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <label htmlFor="resumeAutofill" className={`${labelClass} text-primary`}>Autofill from resume</label>
              <input
                id="resumeAutofill"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeChange}
                className="block w-full text-xs text-gray-500 file:mr-3 file:min-h-[40px] file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold hover:file:bg-primary-hover file:cursor-pointer cursor-pointer"
              />
              <p className="mt-2 text-xs text-gray-400">Upload a PDF or DOCX resume and we'll fill in the details below — you can still edit everything.</p>
              {autofillStatus && (
                <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-primary">{autofillStatus}</p>
              )}
            </section>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="firstName" className={labelClass}>First Name</label>
                <input id="firstName" name="firstName" type="text" placeholder="Juan" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass} />
                {errors.firstName && <p className="text-danger text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="middleName" className={labelClass}>Middle Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input id="middleName" name="middleName" type="text" placeholder="Santos" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>Last Name</label>
                <input id="lastName" name="lastName" type="text" placeholder="Dela Cruz" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass} />
                {errors.lastName && <p className="text-danger text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="suffix" className={labelClass}>Suffix <span className="text-gray-400 font-normal">(optional)</span></label>
                <input id="suffix" name="suffix" type="text" placeholder="Jr., Sr., III" value={form.suffix} onChange={(e) => set("suffix", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="birthdate" className={labelClass}>Birthday</label>
                <input id="birthdate" name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} className={inputClass} />
                {errors.birthdate && <p className="text-danger text-xs mt-1">{errors.birthdate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="mobileNumber" className={labelClass}>Mobile Number</label>
                <input id="mobileNumber" name="mobileNumber" type="tel" placeholder="0917 123 4567" value={form.mobileNumber} onChange={(e) => set("mobileNumber", e.target.value)} className={inputClass} />
                {errors.mobileNumber && <p className="text-danger text-xs mt-1">{errors.mobileNumber}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email Address</label>
              <input id="email" name="email" type="email" placeholder="juan.delacruz@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="password" className={labelClass}>Password</label>
                <input id="password" name="password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputClass} />
                {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} className={inputClass} />
                {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <section className="border-t border-gray-100 pt-4">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Address Information</p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="houseNumberUnit" className={labelClass}>House / Building / Unit No. <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input id="houseNumberUnit" name="houseNumberUnit" type="text" placeholder="e.g. Unit 402 or Bldg 3" value={form.houseNumberUnit} onChange={(e) => set("houseNumberUnit", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="streetAddress" className={labelClass}>Street Address & Lot / Block</label>
                  <input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={inputClass} />
                  {errors.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                </div>
                <div>
                  <label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" value={form.subdivisionBuilding} onChange={(e) => set("subdivisionBuilding", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="barangayDistrict" className={labelClass}>Barangay / District</label>
                  <input id="barangayDistrict" name="barangayDistrict" type="text" placeholder="e.g. Pulong Buhangin" value={form.barangayDistrict} onChange={(e) => set("barangayDistrict", e.target.value)} className={inputClass} />
                  {errors.barangayDistrict && <p className="text-danger text-xs mt-1">{errors.barangayDistrict}</p>}
                </div>
                <div>
                  <label htmlFor="cityMunicipality" className={labelClass}>City / Municipality</label>
                  <input id="cityMunicipality" name="cityMunicipality" type="text" placeholder="e.g. Santa Maria" value={form.cityMunicipality} onChange={(e) => set("cityMunicipality", e.target.value)} className={inputClass} />
                  {errors.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                </div>
                <div>
                  <label htmlFor="provinceState" className={labelClass}>Province / State</label>
                  <input id="provinceState" name="provinceState" type="text" placeholder="e.g. Bulacan" value={form.provinceState} onChange={(e) => set("provinceState", e.target.value)} className={inputClass} />
                  {errors.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                </div>
                <div>
                  <label htmlFor="postalCode" className={labelClass}>Postal / ZIP Code</label>
                  <input id="postalCode" name="postalCode" type="text" inputMode="numeric" placeholder="e.g. 3022" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputClass} />
                  {errors.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                </div>
                <div>
                  <label htmlFor="country" className={labelClass}>Country</label>
                  <input id="country" name="country" type="text" value={form.country} onChange={(e) => set("country", e.target.value)} className={inputClass} />
                </div>
              </div>
            </section>

            <section className="border-t border-gray-100 pt-4">
              <label htmlFor="skills" className={labelClass}>Skills <span className="text-gray-400 font-normal">(optional)</span></label>
              <TagInput id="skills" value={form.skills} onChange={(v) => set("skills", v)} placeholder="Type a skill and press Enter" />
            </section>

            <section className="border-t border-gray-100 pt-4">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Education History</p>
              <div className="grid grid-cols-1 gap-3">
                <select aria-label="Education level" value={education.level} onChange={(e) => setEducation({ ...education, level: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all">
                  <option value="">Education level</option>
                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <input placeholder="School name" value={education.school} onChange={(e) => setEducation({ ...education, school: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                <div className="flex gap-2">
                  <input placeholder="Course / field" value={education.field} onChange={(e) => setEducation({ ...education, field: e.target.value })} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input placeholder="Year" inputMode="numeric" value={education.year} onChange={(e) => setEducation({ ...education, year: e.target.value })} className="w-20 px-3 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">We filled what we found in your resume — confirm or edit it in your profile after signing in.</p>
            </section>

            <label className="flex items-start gap-2.5 text-xs text-gray-500 select-none cursor-pointer pt-2">
              <input type="checkbox" name="agree" checked={form.agree} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5 accent-primary" />
              <span>I agree to the municipal data collection terms and PESO privacy policies.</span>
            </label>
            {errors.agree && <p className="text-danger text-xs mt-1">{errors.agree}</p>}

            {error && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs text-gray-400">
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
    </div>
  );
}

export default JobSeekerRegister;
