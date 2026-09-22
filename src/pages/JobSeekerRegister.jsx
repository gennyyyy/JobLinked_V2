import { useState } from "react";
import { Link } from "react-router-dom";
import { addAccount, findAccountByEmail } from "../utils/userStore";
import Logo from "../assets/Logo.png";
import { barangays } from "../data/barangays";

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function validate(values) {
    const e = {};
    if (!values.firstName?.trim()) e.firstName = "First name is required";
    if (!values.lastName?.trim()) e.lastName = "Last name is required";
    if (!values.email?.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = "Invalid email address";
    if (!values.mobileNumber?.trim()) e.mobileNumber = "Mobile number is required";
    if (!values.barangay) e.barangay = "Barangay is required";
    if (!values.password) e.password = "Password is required";
    else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!values.agree) e.agree = "You must agree to the terms";
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

    if (findAccountByEmail(values.email)) {
      setError("An account with this email already exists. Please log in instead.");
      return;
    }

    setError("");
    addAccount({
      role: "job-seeker",
      email: values.email,
      password: values.password,
      firstName: values.firstName,
      lastName: values.lastName,
    });
    setSubmitted(true);
  }

  const inputClass = "w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";
  const labelClass = "block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5";

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
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold">
              ACCOUNT READY
            </span>
            <h1 className="mt-4 text-2xl font-bold text-dark-blue">
              Registration Complete!
            </h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Your JobLinked applicant account has been created. You can now log in and apply to verified Santa Maria postings.
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
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <circle cx="16" cy="14" r="7" fill="#0057B8"/>
              <circle cx="30" cy="18" r="5" fill="#0057B8"/>
              <path d="M8 38c0-8 6-14 14-14h4c6 0 10 4 10 10v4H8v-4z" fill="#0057B8"/>
              <path d="M22 24c4-6 10-8 16-6l-2 4c-4-2-8 0-10 4" fill="#FFC72C"/>
              <circle cx="42" cy="38" r="4" fill="#E31B23"/>
            </svg>
            <div className="leading-none">
              <span className="text-lg font-extrabold tracking-tight text-dark-blue">JOB</span>
              <span className="text-lg font-extrabold tracking-tight text-primary">LINKED</span>
            </div>
          </Link>
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
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
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">
              Job Seeker Registration
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Fill in your details to create your verified municipal applicant account
            </p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className={labelClass}>First Name</label>
                <input id="firstName" name="firstName" type="text" placeholder="Juan" className={inputClass} onChange={() => { if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined })); }} />
                {errors.firstName && <p className="text-danger text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>Last Name</label>
                <input id="lastName" name="lastName" type="text" placeholder="Dela Cruz" className={inputClass} onChange={() => { if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined })); }} />
                {errors.lastName && <p className="text-danger text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email Address</label>
              <input id="email" name="email" type="email" placeholder="juan.delacruz@example.com" className={inputClass} onChange={() => { if (errors.email) setErrors((prev) => ({ ...prev, email: undefined })); }} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mobileNumber" className={labelClass}>Mobile Number</label>
                <input id="mobileNumber" name="mobileNumber" type="tel" placeholder="0917 123 4567" className={inputClass} onChange={() => { if (errors.mobileNumber) setErrors((prev) => ({ ...prev, mobileNumber: undefined })); }} />
                {errors.mobileNumber && <p className="text-danger text-xs mt-1">{errors.mobileNumber}</p>}
              </div>
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
            </div>

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

            <label className="flex items-start gap-2.5 text-xs text-gray-500 select-none cursor-pointer pt-2">
              <input type="checkbox" name="agree" className="mt-0.5 accent-primary" onChange={() => { if (errors.agree) setErrors((prev) => ({ ...prev, agree: undefined })); }} />
              <span>I agree to the municipal data collection terms and PESO privacy policies.</span>
            </label>
            {errors.agree && <p className="text-danger text-xs mt-1">{errors.agree}</p>}

            {error && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
            >
              Create Account
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

export default JobSeekerRegister;
