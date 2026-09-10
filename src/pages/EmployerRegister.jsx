import { useState } from "react";
import { Link } from "react-router-dom";
import { barangays } from "../data/barangays";
import { addApplication } from "../utils/employerStore";

function FileField({ id, name, label, required }) {
  const [fileName, setFileName] = useState("");

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <label htmlFor={id} className="block text-xs font-medium text-white">
            {label}
            {required ? (
              <span className="text-[#0075A2] ml-1">*</span>
            ) : (
              <span className="text-white/35 font-normal ml-1">(optional)</span>
            )}
          </label>
          <p className="text-[11px] text-white/40 mt-0.5 truncate max-w-[240px] md:max-w-xs">
            {fileName || "PDF or image (max 5MB)"}
          </p>
        </div>

        <label
          htmlFor={id}
          className="cursor-pointer shrink-0 px-4 py-2 text-xs font-medium rounded-lg bg-white/[0.05] border border-white/[0.12] text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-[#0075A2]/50 transition-all"
        >
          {fileName ? "Change" : "Browse"}
        </label>
      </div>

      <input
        id={id}
        name={name}
        type="file"
        required={required}
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(event) => setFileName(event.target.files[0]?.name || "")}
        className="sr-only"
      />
    </div>
  );
}

function EmployerRegister() {
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const values = Object.fromEntries(formData.entries());

    if (values.password !== values.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
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
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              PENDING VERIFICATION
            </span>
            <h1 className="mt-4 text-2xl font-bold text-white">
              Application Submitted
            </h1>
            <p className="mt-3 text-sm text-white/55 leading-relaxed">
              Your business accreditation application is now being reviewed by the Santa Maria PESO staff.
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <Link
                to="/register/employer/status"
                className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
              >
                Track Status →
              </Link>
              <Link
                to="/"
                className="text-xs text-white/45 hover:text-white transition-colors"
              >
                Return to home
              </Link>
            </div>
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
        <div className="w-full max-w-2xl bg-[#272727] border border-white/[0.08] rounded-2xl p-7 md:p-10 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-white/50 hover:text-white transition-colors">
              ← Back to roles
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0075A2]/10 border border-[#0075A2]/25 text-[#0075A2]">
              EMPLOYER ACCREDITATION
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Business Registration
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Submit business details and compliance credentials for Santa Maria PESO accreditation
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1 */}
            <section className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
                Step 1 — Company Details
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                    Company / Trade Name
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    placeholder="e.g. Santa Maria Logistics Inc."
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="businessAddress" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                    Business Address
                  </label>
                  <input
                    id="businessAddress"
                    name="businessAddress"
                    type="text"
                    required
                    placeholder="Street / Building"
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div>
                    <label htmlFor="contactNumber" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                      Company Contact No.
                    </label>
                    <input
                      id="contactNumber"
                      name="contactNumber"
                      type="tel"
                      required
                      placeholder="(044) 000-0000"
                      className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="companyEmail" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                    Official Company Email
                  </label>
                  <input
                    id="companyEmail"
                    name="companyEmail"
                    type="email"
                    required
                    placeholder="hr@company.com"
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                  />
                </div>
              </div>
            </section>

            {/* Step 2 */}
            <section className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
                Step 2 — Authorized Representative
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="repFullName" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="repFullName"
                      name="repFullName"
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="repPosition" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                      Designation / Position
                    </label>
                    <input
                      id="repPosition"
                      name="repPosition"
                      type="text"
                      required
                      placeholder="e.g. HR Manager"
                      className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="repEmail" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                      Representative Email
                    </label>
                    <input
                      id="repEmail"
                      name="repEmail"
                      type="email"
                      required
                      placeholder="maria@company.com"
                      className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="repMobile" className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                      Representative Mobile
                    </label>
                    <input
                      id="repMobile"
                      name="repMobile"
                      type="tel"
                      required
                      placeholder="0917 123 4567"
                      className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Step 3 */}
            <section className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
                Step 3 — Portal Account Password
              </p>
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
            </section>

            {/* Step 4 */}
            <section className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-4">
                Step 4 — Required Accreditations
              </p>
              <div className="space-y-3">
                <FileField id="businessPermit" name="businessPermit" label="Mayor's / Business Permit" required />
                <FileField id="doleRegistration" name="doleRegistration" label="DOLE Registration / Certificate" required />
                <FileField id="fireSafetyCertificate" name="fireSafetyCertificate" label="Fire Safety Inspection Certificate" required />
                <FileField id="otherDocuments" name="otherDocuments" label="Other Supporting Documents" />
              </div>
            </section>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.25)]"
            >
              Submit Accreditation Application
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-white/40">
            Already verified?{" "}
            <Link to="/employer/login" className="text-[#0075A2] hover:underline underline-offset-4 font-medium">
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

export default EmployerRegister;
