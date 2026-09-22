import { useState } from "react";
import { Link } from "react-router-dom";
import { barangays } from "../data/barangays";
import { addApplication } from "../utils/employerStore";
import { addAccount, findAccountByEmail } from "../utils/userStore";
import Logo from "../assets/Logo.png";

function FileField({ id, name, label, required, onClear }) {
  const [fileName, setFileName] = useState("");

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <label htmlFor={id} className="block text-xs font-medium text-gray-700">
            {label}
            {required ? (
              <span className="text-danger ml-1">*</span>
            ) : (
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            )}
          </label>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[240px] md:max-w-xs">
            {fileName || "PDF or image (max 5MB)"}
          </p>
        </div>

        <label
          htmlFor={id}
          className="cursor-pointer shrink-0 px-4 py-2 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-primary hover:border-primary/50 transition-all"
        >
          {fileName ? "Change" : "Browse"}
        </label>
      </div>

      <input
        id={id}
        name={name}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(event) => {
          setFileName(event.target.files[0]?.name || "");
          if (onClear) onClear();
        }}
        className="sr-only"
      />
    </div>
  );
}

function EmployerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function validate(values) {
    const e = {};
    if (!values.companyName?.trim()) e.companyName = "Company name is required";
    if (!values.businessAddress?.trim()) e.businessAddress = "Business address is required";
    if (!values.barangay) e.barangay = "Barangay is required";
    if (!values.contactNumber?.trim()) e.contactNumber = "Contact number is required";
    if (!values.companyEmail?.trim()) e.companyEmail = "Company email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) e.companyEmail = "Invalid email address";
    if (!values.repFullName?.trim()) e.repFullName = "Representative name is required";
    if (!values.repPosition?.trim()) e.repPosition = "Position is required";
    if (!values.repEmail?.trim()) e.repEmail = "Representative email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.repEmail)) e.repEmail = "Invalid email address";
    if (!values.repMobile?.trim()) e.repMobile = "Representative mobile is required";
    if (!values.password) e.password = "Password is required";
    else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!values.businessPermit) e.businessPermit = "Business permit is required";
    if (!values.doleRegistration) e.doleRegistration = "DOLE registration is required";
    if (!values.fireSafetyCertificate) e.fireSafetyCertificate = "Fire safety certificate is required";
    return e;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const values = Object.fromEntries(formData.entries());

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    if (findAccountByEmail(values.companyEmail)) {
      setError("An account with this email already exists. Please log in instead.");
      return;
    }

    setError("");
    addAccount({
      role: "employer",
      email: values.companyEmail,
      password: values.password,
      firstName: values.repFullName?.split(" ")[0] || "",
      lastName: values.repFullName?.split(" ").slice(1).join(" ") || "",
    });
    addApplication({
      company: values.companyName,
      businessAddress: values.businessAddress,
      barangay: values.barangay,
      contactNumber: values.contactNumber,
      companyEmail: values.companyEmail,
      repFullName: values.repFullName,
      repPosition: values.repPosition,
      repEmail: values.repEmail,
      repMobile: values.repMobile,
      password: values.password,
      documents: {
        businessPermit: values.businessPermit?.name || "",
        doleRegistration: values.doleRegistration?.name || "",
        fireSafetyCertificate: values.fireSafetyCertificate?.name || "",
        otherDocuments: values.otherDocuments?.name || "",
      },
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={Logo} alt="JobLinked" className="w-9 h-9" />
              <div className="leading-none">
                <span className="text-lg font-extrabold tracking-tight text-dark-blue">JOB</span>
                <span className="text-lg font-extrabold tracking-tight text-primary">LINKED</span>
              </div>
            </Link>
            <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-xl animate-fade-in">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-accent/20 border border-accent/40 text-dark-blue font-semibold">
              PENDING VERIFICATION
            </span>
            <h1 className="mt-4 text-2xl font-bold text-dark-blue">
              Application Submitted
            </h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Your business accreditation application is now being reviewed by the Santa Maria PESO staff.
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <Link
                to="/register/employer/status"
                className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
              >
                Track Status →
              </Link>
              <Link
                to="/"
                className="text-xs text-gray-400 hover:text-primary transition-colors"
              >
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
            <img src={Logo} alt="JobLinked" className="w-9 h-9" />
            <div className="leading-none">
              <span className="text-lg font-extrabold tracking-tight text-dark-blue">JOB</span>
              <span className="text-lg font-extrabold tracking-tight text-primary">LINKED</span>
            </div>
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
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">
              Business Registration
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Submit business details and compliance credentials for Santa Maria PESO accreditation
            </p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">
                Step 1 — Company Details
              </p>
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
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">
                Step 2 — Authorized Representative
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="repFullName" className={labelClass}>Full Name</label>
                    <input id="repFullName" name="repFullName" type="text" placeholder="e.g. Maria Santos" className={inputClass} onChange={() => { if (errors.repFullName) setErrors((prev) => ({ ...prev, repFullName: undefined })); }} />
                    {errors.repFullName && <p className="text-danger text-xs mt-1">{errors.repFullName}</p>}
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
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">
                Step 3 — Portal Account Password
              </p>
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

            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">
                Step 4 — Required Accreditations
              </p>
              <div className="space-y-3">
                <FileField id="businessPermit" name="businessPermit" label="Mayor's / Business Permit" required onClear={() => { if (errors.businessPermit) setErrors((prev) => ({ ...prev, businessPermit: undefined })); }} />
                {errors.businessPermit && <p className="text-danger text-xs mt-1">{errors.businessPermit}</p>}
                <FileField id="doleRegistration" name="doleRegistration" label="DOLE Registration / Certificate" required onClear={() => { if (errors.doleRegistration) setErrors((prev) => ({ ...prev, doleRegistration: undefined })); }} />
                {errors.doleRegistration && <p className="text-danger text-xs mt-1">{errors.doleRegistration}</p>}
                <FileField id="fireSafetyCertificate" name="fireSafetyCertificate" label="Fire Safety Inspection Certificate" required onClear={() => { if (errors.fireSafetyCertificate) setErrors((prev) => ({ ...prev, fireSafetyCertificate: undefined })); }} />
                {errors.fireSafetyCertificate && <p className="text-danger text-xs mt-1">{errors.fireSafetyCertificate}</p>}
                <FileField id="otherDocuments" name="otherDocuments" label="Other Supporting Documents" />
              </div>
            </section>

            {error && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
            >
              Submit Accreditation Application
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
