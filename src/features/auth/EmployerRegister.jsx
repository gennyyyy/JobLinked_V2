import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../../shared/services/auth";
import Logo from "../../assets/TextBased Logo.png";

function EmployerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
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
    if (!values.barangayDistrict) e.barangayDistrict = "Barangay is required";
    if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
    if (!values.provinceState?.trim()) e.provinceState = "Province / State is required";
    if (!values.postalCode?.trim()) e.postalCode = "Postal code is required";
    if (!values.contactNumber?.trim()) e.contactNumber = "Contact number is required";
    if (!values.companyEmail?.trim()) e.companyEmail = "Company email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) e.companyEmail = "Invalid email address";
    if (!values.repFirstName?.trim()) e.repFirstName = "First name is required";
    if (!values.repLastName?.trim()) e.repLastName = "Last name is required";
    if (!values.repPosition?.trim()) e.repPosition = "Position is required";
    if (!values.repEmail?.trim()) e.repEmail = "Representative email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.repEmail)) e.repEmail = "Invalid email address";
    if (!values.repMobile?.trim()) e.repMobile = "Representative mobile is required";
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
          phone: values.repMobile.trim(),
          birthdate: values.repBirthdate,
          companyName: values.companyName.trim(),
          industry: values.industry.trim(),
          companyPhone: values.contactNumber.trim(),
          companyEmail: values.companyEmail.trim(),
          representativeEmail: values.repEmail.trim(),
          representativePosition: values.repPosition.trim(),
          houseNumberUnit: values.houseNumberUnit?.trim() || "",
          streetAddress: values.streetAddress.trim(),
          subdivisionBuilding: values.subdivisionBuilding?.trim() || "",
          barangayDistrict: values.barangayDistrict,
          cityMunicipality: values.cityMunicipality.trim(),
          provinceState: values.provinceState.trim(),
          postalCode: values.postalCode.trim(),
          country: values.country?.trim() || "Philippines",
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
        <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10 shadow-sm">
          <div className="w-full px-4 h-[64px] flex items-center justify-between">
            <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
              <Link to="/"><img src={Logo} alt="JobLinked" className="h-10" /></Link>
            </div>
            <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-[3%]">
          <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-xl animate-fade-in">
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
              <Link to="/" className="text-xs text-gray-400 hover:text-primary transition-colors">
                Return to home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const inputClass = "w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";
  const labelClass = "block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5";

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
        <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl p-7 md:p-10 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-gray-400 hover:text-primary transition-colors">
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

          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 1 — Company Details</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className={labelClass}>Company / Trade Name</label>
                  <input id="companyName" name="companyName" type="text" placeholder="e.g. Santa Maria Logistics Inc." className={inputClass} onChange={() => { if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: undefined })); }} />
                  {errors.companyName && <p className="text-danger text-xs mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <label htmlFor="industry" className={labelClass}>Company Industry</label>
                  <input id="industry" name="industry" type="text" placeholder="e.g. Manufacturing, IT, Retail" className={inputClass} onChange={() => { if (errors.industry) setErrors((prev) => ({ ...prev, industry: undefined })); }} />
                  {errors.industry && <p className="text-danger text-xs mt-1">{errors.industry}</p>}
                </div>
                <div>
                  <p className={labelClass}>Address Information</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="houseNumberUnit" className={labelClass}>House / Building / Unit No. <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input id="houseNumberUnit" name="houseNumberUnit" type="text" placeholder="e.g. Unit 402 or Bldg 3" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="streetAddress" className={labelClass}>Street Address & Lot / Block</label>
                      <input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" className={inputClass} onChange={() => { if (errors.streetAddress) setErrors((prev) => ({ ...prev, streetAddress: undefined })); }} />
                      {errors.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                    </div>
                    <div>
                      <label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="barangayDistrict" className={labelClass}>Barangay / District</label>
                      <input id="barangayDistrict" name="barangayDistrict" type="text" placeholder="e.g. Pulong Buhangin" className={inputClass} onChange={() => { if (errors.barangayDistrict) setErrors((prev) => ({ ...prev, barangayDistrict: undefined })); }} />
                      {errors.barangayDistrict && <p className="text-danger text-xs mt-1">{errors.barangayDistrict}</p>}
                    </div>
                    <div>
                      <label htmlFor="cityMunicipality" className={labelClass}>City / Municipality</label>
                      <input id="cityMunicipality" name="cityMunicipality" type="text" placeholder="e.g. Santa Maria" className={inputClass} onChange={() => { if (errors.cityMunicipality) setErrors((prev) => ({ ...prev, cityMunicipality: undefined })); }} />
                      {errors.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                    </div>
                    <div>
                      <label htmlFor="provinceState" className={labelClass}>Province / State</label>
                      <input id="provinceState" name="provinceState" type="text" placeholder="e.g. Bulacan" className={inputClass} onChange={() => { if (errors.provinceState) setErrors((prev) => ({ ...prev, provinceState: undefined })); }} />
                      {errors.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                    </div>
                    <div>
                      <label htmlFor="postalCode" className={labelClass}>Postal / ZIP Code</label>
                      <input id="postalCode" name="postalCode" type="text" inputMode="numeric" placeholder="e.g. 3022" className={inputClass} onChange={() => { if (errors.postalCode) setErrors((prev) => ({ ...prev, postalCode: undefined })); }} />
                      {errors.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                    </div>
                    <div>
                      <label htmlFor="country" className={labelClass}>Country</label>
                      <input id="country" name="country" type="text" defaultValue="Philippines" className={inputClass} />
                    </div>
                  </div>
                </div>
                <div>
                  <div>
                    <label htmlFor="contactNumber" className={labelClass}>Company Contact No.</label>
                    <input id="contactNumber" name="contactNumber" type="tel" placeholder="(044) 000-0000" className={inputClass} onChange={() => { if (errors.contactNumber) setErrors((prev) => ({ ...prev, contactNumber: undefined })); }} />
                    {errors.contactNumber && <p className="text-danger text-xs mt-1">{errors.contactNumber}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="companyEmail" className={labelClass}>Official Company Email</label>
                  <input id="companyEmail" name="companyEmail" type="email" placeholder="hr@company.com" className={inputClass} onChange={() => { if (errors.companyEmail) setErrors((prev) => ({ ...prev, companyEmail: undefined })); }} />
                  {errors.companyEmail && <p className="text-danger text-xs mt-1">{errors.companyEmail}</p>}
                </div>
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div>
                    <label htmlFor="password" className={labelClass}>Password</label>
                    <input id="password" name="password" type="password" placeholder="Min. 8 characters" className={inputClass} onChange={() => { if (errors.password) setErrors((prev) => ({ ...prev, password: undefined })); }} />
                    {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
                    <input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter password" className={inputClass} onChange={() => { if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined })); }} />
                    {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Authorized Representative</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="repFirstName" className={labelClass}>First Name</label>
                    <input id="repFirstName" name="repFirstName" type="text" placeholder="Maria" className={inputClass} onChange={() => { if (errors.repFirstName) setErrors((prev) => ({ ...prev, repFirstName: undefined })); }} />
                    {errors.repFirstName && <p className="text-danger text-xs mt-1">{errors.repFirstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="repMiddleName" className={labelClass}>Middle Name <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input id="repMiddleName" name="repMiddleName" type="text" placeholder="Santos" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="repLastName" className={labelClass}>Last Name</label>
                    <input id="repLastName" name="repLastName" type="text" placeholder="Reyes" className={inputClass} onChange={() => { if (errors.repLastName) setErrors((prev) => ({ ...prev, repLastName: undefined })); }} />
                    {errors.repLastName && <p className="text-danger text-xs mt-1">{errors.repLastName}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="repSuffix" className={labelClass}>Suffix <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input id="repSuffix" name="repSuffix" type="text" placeholder="Jr., Sr., III" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="repPosition" className={labelClass}>Designation / Position</label>
                    <input id="repPosition" name="repPosition" type="text" placeholder="e.g. HR Manager" className={inputClass} onChange={() => { if (errors.repPosition) setErrors((prev) => ({ ...prev, repPosition: undefined })); }} />
                    {errors.repPosition && <p className="text-danger text-xs mt-1">{errors.repPosition}</p>}
                  </div>
                  <div>
                    <label htmlFor="repBirthdate" className={labelClass}>Birthday</label>
                    <input id="repBirthdate" name="repBirthdate" type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} onChange={() => { if (errors.repBirthdate) setErrors((prev) => ({ ...prev, repBirthdate: undefined })); }} />
                    {errors.repBirthdate && <p className="text-danger text-xs mt-1">{errors.repBirthdate}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="repMobile" className={labelClass}>Representative Mobile</label>
                    <input id="repMobile" name="repMobile" type="tel" placeholder="0917 123 4567" className={inputClass} onChange={() => { if (errors.repMobile) setErrors((prev) => ({ ...prev, repMobile: undefined })); }} />
                    {errors.repMobile && <p className="text-danger text-xs mt-1">{errors.repMobile}</p>}
                  </div>
                  <div>
                    <label htmlFor="repEmail" className={labelClass}>Representative Email</label>
                    <input id="repEmail" name="repEmail" type="email" placeholder="maria@company.com" className={inputClass} onChange={() => { if (errors.repEmail) setErrors((prev) => ({ ...prev, repEmail: undefined })); }} />
                    {errors.repEmail && <p className="text-danger text-xs mt-1">{errors.repEmail}</p>}
                  </div>
                </div>
              </div>
            </section>

            {error && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit Accreditation Application"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            Already verified?{" "}
            <Link to="/employer/login" className="text-primary hover:underline underline-offset-4 font-medium">
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

export default EmployerRegister;
