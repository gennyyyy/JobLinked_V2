import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { signUp } from "../services/auth";
import { listBarangays } from "../services/admin";
import { createAccreditation } from "../services/documents";
import { supabase } from "../lib/supabase";
import Logo from "../assets/TextBased Logo.png";

function EmployerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [barangays, setBarangays] = useState([]);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    listBarangays().then((rows) => setBarangays(rows.map((b) => b.name))).catch(() => {});
  }, []);

  function validate(values) {
    const e = {};
    if (!values.companyName?.trim()) e.companyName = "Company name is required";
    if (!values.businessAddress?.trim()) e.businessAddress = "Business address is required";
    if (!values.barangay) e.barangay = "Barangay is required";
    if (!values.contactNumber?.trim()) e.contactNumber = "Contact number is required";
    if (!values.companyEmail?.trim()) e.companyEmail = "Company email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) e.companyEmail = "Invalid email address";
    if (!values.repFirstName?.trim()) e.repFirstName = "First name is required";
    if (!values.repLastName?.trim()) e.repLastName = "Last name is required";
    if (!values.repPosition?.trim()) e.repPosition = "Position is required";
    if (!values.repEmail?.trim()) e.repEmail = "Representative email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.repEmail)) e.repEmail = "Invalid email address";
    if (!values.repMobile?.trim()) e.repMobile = "Representative mobile is required";
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
      const newUser = await signUp({
        email: values.companyEmail.trim(),
        password: values.password,
        role: "employer",
        firstName: values.repFirstName.trim(),
        middleName: values.repMiddleName?.trim() || "",
        lastName: values.repLastName.trim(),
        suffix: values.repSuffix?.trim() || "",
        extra: { phone: values.repMobile.trim() },
      });

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          owner_id: newUser.id,
          name: values.companyName.trim(),
          address: values.businessAddress.trim(),
          barangay: values.barangay,
          phone: values.contactNumber.trim(),
        })
        .select()
        .maybeSingle();
      if (companyError) {
        if (companyError.code === "23505") {
          setWarning("A company profile already exists for this account. You can update it after logging in.");
          setSubmitted(true);
          return;
        }
        throw companyError;
      }

      await createAccreditation(company.id);

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
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={Logo} alt="JobLinked" className="h-10" />
            </Link>
            <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-xl animate-fade-in">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-accent/20 border border-accent/40 text-dark-blue font-semibold">
              PENDING VERIFICATION
            </span>
            <h1 className="mt-4 text-2xl font-bold text-dark-blue">Application Submitted</h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Your business accreditation application is now being reviewed by the Santa Maria PESO staff.
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
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="JobLinked" className="h-10" />
          </Link>
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
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
                  <label htmlFor="businessAddress" className={labelClass}>Business Address</label>
                  <input id="businessAddress" name="businessAddress" type="text" placeholder="Street / Building" className={inputClass} onChange={() => { if (errors.businessAddress) setErrors((prev) => ({ ...prev, businessAddress: undefined })); }} />
                  {errors.businessAddress && <p className="text-danger text-xs mt-1">{errors.businessAddress}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="barangay" className={labelClass}>Barangay</label>
                    <select id="barangay" name="barangay" defaultValue="" className={inputClass} onChange={() => { if (errors.barangay) setErrors((prev) => ({ ...prev, barangay: undefined })); }}>
                      <option value="" disabled>Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    {errors.barangay && <p className="text-danger text-xs mt-1">{errors.barangay}</p>}
                  </div>
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
              </div>
            </section>

            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Authorized Representative</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="repFirstName" className={labelClass}>First Name</label>
                    <input id="repFirstName" name="repFirstName" type="text" placeholder="Maria" className={inputClass} onChange={() => { if (errors.repFirstName) setErrors((prev) => ({ ...prev, repFirstName: undefined })); }} />
                    {errors.repFirstName && <p className="text-danger text-xs mt-1">{errors.repFirstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="repMiddleName" className={labelClass}>Middle Name</label>
                    <input id="repMiddleName" name="repMiddleName" type="text" placeholder="Santos" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="repLastName" className={labelClass}>Last Name</label>
                    <input id="repLastName" name="repLastName" type="text" placeholder="Reyes" className={inputClass} onChange={() => { if (errors.repLastName) setErrors((prev) => ({ ...prev, repLastName: undefined })); }} />
                    {errors.repLastName && <p className="text-danger text-xs mt-1">{errors.repLastName}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="repSuffix" className={labelClass}>Suffix <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input id="repSuffix" name="repSuffix" type="text" placeholder="Jr., Sr., III" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="repPosition" className={labelClass}>Designation / Position</label>
                    <input id="repPosition" name="repPosition" type="text" placeholder="e.g. HR Manager" className={inputClass} onChange={() => { if (errors.repPosition) setErrors((prev) => ({ ...prev, repPosition: undefined })); }} />
                    {errors.repPosition && <p className="text-danger text-xs mt-1">{errors.repPosition}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="repEmail" className={labelClass}>Representative Email</label>
                    <input id="repEmail" name="repEmail" type="email" placeholder="maria@company.com" className={inputClass} onChange={() => { if (errors.repEmail) setErrors((prev) => ({ ...prev, repEmail: undefined })); }} />
                    {errors.repEmail && <p className="text-danger text-xs mt-1">{errors.repEmail}</p>}
                  </div>
                  <div>
                    <label htmlFor="repMobile" className={labelClass}>Representative Mobile</label>
                    <input id="repMobile" name="repMobile" type="tel" placeholder="0917 123 4567" className={inputClass} onChange={() => { if (errors.repMobile) setErrors((prev) => ({ ...prev, repMobile: undefined })); }} />
                    {errors.repMobile && <p className="text-danger text-xs mt-1">{errors.repMobile}</p>}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 3 — Portal Account Password</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </section>

            {error && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            {warning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">{warning}</div>
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
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
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
