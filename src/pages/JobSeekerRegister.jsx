import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../services/auth";
import Logo from "../assets/TextBased Logo.png";

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (submitted && !needsConfirmation) {
      const timer = setTimeout(() => navigate('/job-seeker/dashboard'), 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, needsConfirmation, navigate]);
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
        email: values.email.trim(),
        password: values.password,
        role: "job-seeker",
        firstName: values.firstName.trim(),
        middleName: values.middleName?.trim() || "",
        lastName: values.lastName.trim(),
        suffix: values.suffix?.trim() || "",
        extra: {
          phone: values.mobileNumber.trim(),
          birthdate: values.birthdate,
          houseNumberUnit: values.houseNumberUnit?.trim() || "",
          streetAddress: values.streetAddress.trim(),
          subdivisionBuilding: values.subdivisionBuilding?.trim() || "",
          barangayDistrict: values.barangayDistrict,
          cityMunicipality: values.cityMunicipality.trim(),
          provinceState: values.provinceState.trim(),
          postalCode: values.postalCode.trim(),
          country: values.country,
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
          <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-xl animate-fade-in">
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
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-xl animate-fade-in">
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
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="firstName" className={labelClass}>First Name</label>
                <input id="firstName" name="firstName" type="text" placeholder="Juan" className={inputClass} onChange={() => { if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined })); }} />
                {errors.firstName && <p className="text-danger text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="middleName" className={labelClass}>Middle Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input id="middleName" name="middleName" type="text" placeholder="Santos" className={inputClass} />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>Last Name</label>
                <input id="lastName" name="lastName" type="text" placeholder="Dela Cruz" className={inputClass} onChange={() => { if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined })); }} />
                {errors.lastName && <p className="text-danger text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="suffix" className={labelClass}>Suffix <span className="text-gray-400 font-normal">(optional)</span></label>
                <input id="suffix" name="suffix" type="text" placeholder="Jr., Sr., III" className={inputClass} />
              </div>
              <div>
                <label htmlFor="birthdate" className={labelClass}>Birthday</label>
                <input id="birthdate" name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} onChange={() => { if (errors.birthdate) setErrors((prev) => ({ ...prev, birthdate: undefined })); }} />
                {errors.birthdate && <p className="text-danger text-xs mt-1">{errors.birthdate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="mobileNumber" className={labelClass}>Mobile Number</label>
                <input id="mobileNumber" name="mobileNumber" type="tel" placeholder="0917 123 4567" className={inputClass} onChange={() => { if (errors.mobileNumber) setErrors((prev) => ({ ...prev, mobileNumber: undefined })); }} />
                {errors.mobileNumber && <p className="text-danger text-xs mt-1">{errors.mobileNumber}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email Address</label>
              <input id="email" name="email" type="email" placeholder="juan.delacruz@example.com" className={inputClass} onChange={() => { if (errors.email) setErrors((prev) => ({ ...prev, email: undefined })); }} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4">
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

            <section className="border-t border-gray-100 pt-4">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Address Information</p>
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
            </section>

            <label className="flex items-start gap-2.5 text-xs text-gray-500 select-none cursor-pointer pt-2">
              <input type="checkbox" name="agree" className="mt-0.5 accent-primary" onChange={() => { if (errors.agree) setErrors((prev) => ({ ...prev, agree: undefined })); }} />
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
