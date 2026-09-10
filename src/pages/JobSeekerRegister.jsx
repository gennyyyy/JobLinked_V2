import { useState } from "react";
import { Link } from "react-router-dom";
import { addAccount, findAccountByEmail } from "../utils/userStore";
import { barangays } from "../data/barangays";

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const values = Object.fromEntries(formData.entries());

    if (!values.agree) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

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

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#272727] text-slate-100 flex flex-col font-sans">
        <header className="sticky top-0 z-20 bg-[#272727]/80 backdrop-blur border-b border-white/[0.06]">
          <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
            <Link to="/" className="text-[15px] font-semibold tracking-tight text-white">
              Job<span className="text-[#0075A2]">Linked</span>
            </Link>
            <span className="font-mono text-[11px] text-white/30">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full text-center bg-[#272727] border border-white/[0.08] rounded-2xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              ACCOUNT READY
            </span>
            <h1 className="mt-4 text-2xl font-bold text-white">
              Registration Complete!
            </h1>
            <p className="mt-3 text-sm text-white/55 leading-relaxed">
              Your JobLinked applicant account has been created. You can now log in and apply to verified Santa Maria postings.
            </p>
            <Link
              to="/job-seeker/login"
              className="inline-flex mt-6 min-h-[44px] items-center justify-center px-8 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
            >
              Sign In to Portal →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#272727] text-slate-100 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-[#272727]/80 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-white">
            Job<span className="text-[#0075A2]">Linked</span>
          </Link>
          <span className="font-mono text-[11px] text-white/30">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl bg-[#272727] border border-white/[0.08] rounded-2xl p-7 md:p-9 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-white/50 hover:text-white transition-colors">
              ← Back to roles
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0075A2]/10 border border-[#0075A2]/25 text-[#0075A2]">
              JOB SEEKER
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Job Seeker Registration
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Fill in your details to create your verified municipal applicant account
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  placeholder="Juan"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  placeholder="Dela Cruz"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="juan.delacruz@example.com"
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mobileNumber" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Mobile Number
                </label>
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  required
                  placeholder="0917 123 4567"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>

              <div>
                <label htmlFor="barangay" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Barangay
                </label>
                <select
                  id="barangay"
                  name="barangay"
                  required
                  defaultValue=""
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                >
                  <option value="" disabled className="text-white/30">Select Barangay</option>
                  {barangays.map((b) => (
                    <option key={b} value={b} className="bg-[#272727] text-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Re-enter password"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-white/60 select-none cursor-pointer pt-2">
              <input
                type="checkbox"
                name="agree"
                required
                className="mt-0.5 accent-[#0075A2]"
              />
              <span>
                I agree to the municipal data collection terms and PESO privacy policies.
              </span>
            </label>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.25)]"
            >
              Create Account
            </button>
          </form>

          <p className="mt-7 text-center text-xs text-white/40">
            Already registered?{" "}
            <Link to="/job-seeker/login" className="text-[#0075A2] hover:underline underline-offset-4 font-medium">
              Log in here
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#060608] text-white/30">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">
            Job<span className="text-[#0075A2]">Linked</span> <span className="text-white/40">PESO</span>
          </span>
          <span>Santa Maria Municipal Hall · hello@joblinked.ph</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default JobSeekerRegister;
