import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../../shared/services/auth";
import { normalizePhone, isValidPhone, toLocalDigits } from "../../shared/utils/phone";
import { BULACAN_MUNICIPALITIES, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import SkipLink from "../../shared/components/SkipLink";
import PublicHeader from "../../shared/components/PublicHeader";
import PublicFooter from "../../shared/components/PublicFooter";

function EmployerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const formRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (submitted && !needsConfirmation) {
      const timer = setTimeout(() => navigate('/employer'), 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, needsConfirmation, navigate]);

  function validate(values) {
    const e = {};
    if (!values.companyName?.trim()) e.companyName = "Company name is required";
    if (!values.industry?.trim()) e.industry = "Industry is required";
    if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
    if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
    if (!values.provinceState?.trim()) e.provinceState = "Province is required";
    if (values.postalCode?.trim() && !/^\d{4}$/.test(values.postalCode.trim())) e.postalCode = "Postal code must be 4 digits";
    if (!values.contactNumber?.trim()) e.contactNumber = "Contact number is required";
    else if (!isValidPhone(values.contactNumber)) e.contactNumber = "Enter a valid number (e.g. 44 000 0000)";
    if (!values.companyEmail?.trim()) e.companyEmail = "Company email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) e.companyEmail = "Invalid email address";
    if (!values.repFirstName?.trim()) e.repFirstName = "First name is required";
    if (!values.repLastName?.trim()) e.repLastName = "Last name is required";
    if (!values.repPosition?.trim()) e.repPosition = "Position is required";
    if (!values.repEmail?.trim()) e.repEmail = "Representative email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.repEmail)) e.repEmail = "Invalid email address";
    if (!values.repMobile?.trim()) e.repMobile = "Representative mobile is required";
    else if (!isValidPhone(values.repMobile)) e.repMobile = "Enter a valid number (e.g. 917 123 4567)";
    if (!values.repBirthdate) e.repBirthdate = "Birthday is required";
    if (!values.password) e.password = "Password is required";
    else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
    return e;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const values = Object.fromEntries(formData.entries());

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstError(firstErrorKey(validationErrors));
      return;
    }
    setErrors({});
    setBusy(true);
    setError("");
    try {
      const account = await signUp({
        email: values.companyEmail.trim(),
        password: values.password,
        role: "employer",
        firstName: values.repFirstName.trim(),
        middleName: values.repMiddleName?.trim() || "",
        lastName: values.repLastName.trim(),
        suffix: values.repSuffix?.trim() || "",
        extra: {
          phone: normalizePhone(values.repMobile),
          birthdate: values.repBirthdate,
          companyName: values.companyName.trim(),
          industry: values.industry.trim(),
          companyEmail: values.companyEmail.trim(),
          representativeEmail: values.repEmail.trim(),
          representativePosition: values.repPosition.trim(),
          houseNumberUnit: values.houseNumberUnit?.trim() || "",
          streetAddress: values.streetAddress.trim(),
          subdivisionBuilding: values.subdivisionBuilding?.trim() || "",
          barangayDistrict: values.barangayDistrict?.trim() || "",
          cityMunicipality: values.cityMunicipality.trim(),
          provinceState: values.provinceState.trim(),
          postalCode: values.postalCode?.trim() || "",
          country: "Philippines",
        },
      });

      if (account.emailConfirmationRequired) {
        setNeedsConfirmation(true);
        setSubmitted(true);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
        <SkipLink />
        <PublicHeader />

        <main id="main-content" tabIndex={-1}
          className="flex-1 flex items-center justify-center p-[5%]">
          <div className="max-w-md w-full text-center bg-white border border-primary rounded-lg p-6 shadow-xl">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-accent/20 border border-accent/40 text-dark-blue font-semibold">
              {needsConfirmation ? "VERIFY YOUR EMAIL" : "PENDING VERIFICATION"}
            </span>
            <h1 className="mt-4 text-2xl font-bold text-dark-blue">{needsConfirmation ? "Check Your Email" : "Application Submitted"}</h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              {needsConfirmation
                ? "We sent a verification link to your company email. Confirm it, then sign in — you'll finish setting up your company profile on first login."
                : "Your business accreditation application is now being reviewed by the Santa Maria PESO staff."}
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <Link
                to="/employer/login"
                className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
              >
                Go to Login →
              </Link>
              <Link to="/" className="text-xs text-gray-500 hover:text-primary transition-colors">
                Return to home
              </Link>
            </div>
          </div>
        </main>

        <PublicFooter />
      </div>
    );
  }

  const inputClass = "w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";
  const labelClass = "block font-mono text-[11px] tracking-wider text-gray-600 uppercase mb-1.5";
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
  // empty field above to a later one.
  function firstErrorKey(errors) {
    const formEl = formRef.current;
    if (formEl) {
      for (const el of formEl.querySelectorAll("[id]")) {
        if (errors[el.id]) return el.id;
      }
    }
    return Object.keys(errors)[0] ?? null;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <SkipLink />
      <PublicHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center p-[5%]">
        <div className="w-full max-w-4xl bg-white border border-primary rounded-lg p-6 md:p-10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-gray-500 hover:text-primary transition-colors">
              ← Back to roles
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
              EMPLOYER ACCREDITATION
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Business Registration</h1>
            <p className="mt-2 text-sm text-gray-500">Submit business details and compliance credentials for Santa Maria PESO accreditation</p>
          </header>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 register-form">
            <section className="bg-gray-50 border border-primary rounded-lg p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 1 — Company Details</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className={labelClass}>Company / Trade Name{reqMark}</label>
                  <input id="companyName" name="companyName" type="text" placeholder="e.g. Santa Maria Logistics Inc." className={inputClass} onChange={() => { if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: undefined })); }} />
                  {errors.companyName && <p className="text-danger text-xs mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <label htmlFor="industry" className={labelClass}>Company Industry{reqMark}</label>
                  <input id="industry" name="industry" type="text" placeholder="e.g. Manufacturing, IT, Retail" className={inputClass} onChange={() => { if (errors.industry) setErrors((prev) => ({ ...prev, industry: undefined })); }} />
                  {errors.industry && <p className="text-danger text-xs mt-1">{errors.industry}</p>}
                </div>
                <div>
                  <p className={labelClass}>Address Information</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label htmlFor="houseNumberUnit" className={labelClass}>House / Building / Unit No. <span className="text-gray-500 font-normal">(optional)</span></label>
                      <input id="houseNumberUnit" name="houseNumberUnit" type="text" placeholder="e.g. Unit 402 or Bldg 3" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="streetAddress" className={labelClass}>Street Address & Lot / Block{reqMark}</label>
                      <input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" className={inputClass} onChange={() => { if (errors.streetAddress) setErrors((prev) => ({ ...prev, streetAddress: undefined })); }} />
                      {errors.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                    </div>
                    <div>
                      <label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-gray-500 font-normal">(optional)</span></label>
                      <input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="barangayDistrict" className={labelClass}>Barangay / District <span className="text-gray-500 font-normal">(optional)</span></label>
                      <select id="barangayDistrict" name="barangayDistrict" className={inputClass}>
                        <option value="">Select barangay</option>
                        {SANTA_MARIA_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cityMunicipality" className={labelClass}>City / Municipality{reqMark}</label>
                      <select id="cityMunicipality" name="cityMunicipality" className={inputClass} onChange={() => { if (errors.cityMunicipality) setErrors((prev) => ({ ...prev, cityMunicipality: undefined })); }}>
                        <option value="">Select city / municipality</option>
                        {BULACAN_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {errors.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                    </div>
                    <div>
                      <label htmlFor="provinceState" className={labelClass}>Province / State{reqMark}</label>
                      <select id="provinceState" name="provinceState" className={inputClass} onChange={() => { if (errors.provinceState) setErrors((prev) => ({ ...prev, provinceState: undefined })); }}>
                        <option value="">Select province</option>
                        <option value="Bulacan">Bulacan</option>
                      </select>
                      {errors.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                    </div>
                    <div>
                      <label htmlFor="postalCode" className={labelClass}>Postal Code <span className="text-gray-500 font-normal">(optional)</span></label>
                      <input id="postalCode" name="postalCode" type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 3022" className={inputClass} onChange={() => { if (errors.postalCode) setErrors((prev) => ({ ...prev, postalCode: undefined })); }} />
                      {errors.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                    </div>
                  </div>
                </div>
                <div>
                  <div>
                    <label htmlFor="contactNumber" className={labelClass}>Company Contact No.{reqMark}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">+63</span>
                      <input id="contactNumber" name="contactNumber" type="tel" inputMode="numeric" maxLength={10} placeholder="44 000 0000" className={`${inputClass} pl-12`} onBlur={(e) => { e.target.value = toLocalDigits(e.target.value); }} onChange={() => { if (errors.contactNumber) setErrors((prev) => ({ ...prev, contactNumber: undefined })); }} />
                    </div>
                    {errors.contactNumber && <p className="text-danger text-xs mt-1">{errors.contactNumber}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="companyEmail" className={labelClass}>Official Company Email{reqMark}</label>
                  <input id="companyEmail" name="companyEmail" type="email" placeholder="hr@company.com" className={inputClass} onChange={() => { if (errors.companyEmail) setErrors((prev) => ({ ...prev, companyEmail: undefined })); }} />
                  {errors.companyEmail && <p className="text-danger text-xs mt-1">{errors.companyEmail}</p>}
                </div>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <div>
                    <label htmlFor="password" className={labelClass}>Password{reqMark}</label>
                    <input id="password" name="password" type="password" placeholder="Min. 8 characters" className={inputClass} onChange={() => { if (errors.password) setErrors((prev) => ({ ...prev, password: undefined })); }} />
                    {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className={labelClass}>Confirm Password{reqMark}</label>
                    <input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter password" className={inputClass} onChange={() => { if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined })); }} />
                    {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 border border-primary rounded-lg p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Authorized Representative</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="repFirstName" className={labelClass}>First Name{reqMark}</label>
                  <input id="repFirstName" name="repFirstName" type="text" placeholder="Maria" className={inputClass} onChange={() => { if (errors.repFirstName) setErrors((prev) => ({ ...prev, repFirstName: undefined })); }} />
                    {errors.repFirstName && <p className="text-danger text-xs mt-1">{errors.repFirstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="repMiddleName" className={labelClass}>Middle Name <span className="text-gray-500 font-normal">(optional)</span></label>
                    <input id="repMiddleName" name="repMiddleName" type="text" placeholder="Santos" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="repLastName" className={labelClass}>Last Name{reqMark}</label>
                  <input id="repLastName" name="repLastName" type="text" placeholder="Reyes" className={inputClass} onChange={() => { if (errors.repLastName) setErrors((prev) => ({ ...prev, repLastName: undefined })); }} />
                    {errors.repLastName && <p className="text-danger text-xs mt-1">{errors.repLastName}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="repSuffix" className={labelClass}>Suffix <span className="text-gray-500 font-normal">(optional)</span></label>
                  <input id="repSuffix" name="repSuffix" type="text" placeholder="Jr., Sr., III" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="repPosition" className={labelClass}>Designation / Position{reqMark}</label>
                    <input id="repPosition" name="repPosition" type="text" placeholder="e.g. HR Manager" className={inputClass} onChange={() => { if (errors.repPosition) setErrors((prev) => ({ ...prev, repPosition: undefined })); }} />
                    {errors.repPosition && <p className="text-danger text-xs mt-1">{errors.repPosition}</p>}
                  </div>
                  <div>
                    <label htmlFor="repBirthdate" className={labelClass}>Birthday{reqMark}</label>
                    <input id="repBirthdate" name="repBirthdate" type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} onChange={() => { if (errors.repBirthdate) setErrors((prev) => ({ ...prev, repBirthdate: undefined })); }} />
                    {errors.repBirthdate && <p className="text-danger text-xs mt-1">{errors.repBirthdate}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="repMobile" className={labelClass}>Representative Mobile{reqMark}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">+63</span>
                      <input id="repMobile" name="repMobile" type="tel" inputMode="numeric" maxLength={10} placeholder="917 123 4567" className={`${inputClass} pl-12`} onBlur={(e) => { e.target.value = toLocalDigits(e.target.value); }} onChange={() => { if (errors.repMobile) setErrors((prev) => ({ ...prev, repMobile: undefined })); }} />
                    </div>
                    {errors.repMobile && <p className="text-danger text-xs mt-1">{errors.repMobile}</p>}
                  </div>
                  <div>
                    <label htmlFor="repEmail" className={labelClass}>Representative Email{reqMark}</label>
                    <input id="repEmail" name="repEmail" type="email" placeholder="maria@company.com" className={inputClass} onChange={() => { if (errors.repEmail) setErrors((prev) => ({ ...prev, repEmail: undefined })); }} />
                    {errors.repEmail && <p className="text-danger text-xs mt-1">{errors.repEmail}</p>}
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
              {busy ? "Submitting…" : "Submit Accreditation Application"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500">
            Already verified?{" "}
            <Link to="/employer/login" className="text-primary hover:underline underline-offset-4 font-medium">
              Log in here
            </Link>
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default EmployerRegister;
