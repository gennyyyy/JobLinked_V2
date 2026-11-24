import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "@/shared/services/auth";
import useCaptcha from "@/shared/hooks/useCaptcha";
import TermsModal from "@/shared/components/TermsModal";
import RegistrationConfirmModal from "./RegistrationConfirmModal";
import SkipLink from "@/shared/components/SkipLink";
import Turnstile from "@/shared/components/Turnstile";
import PublicShell from "@/shared/components/PublicShell";
import JobSeekerRegisterSuccess from "./JobSeekerRegisterSuccess";
import JobSeekerPersonalStep from "./JobSeekerPersonalStep";
import JobSeekerAddressStep from "./JobSeekerAddressStep";
import JobSeekerBackgroundStep from "./JobSeekerBackgroundStep";
import { useResumeAutofill } from "./useResumeAutofill";
import {
  EMPTY_FORM,
  validate,
  validateEducation,
  buildJobSeekerSignUpPayload,
} from "./jobSeekerRegistration";

const TOTAL_STEPS = 3;
const STEP_FIELDS = [
  ["firstName", "lastName", "email", "mobileNumber", "birthdate", "employmentStatus", "password", "confirmPassword", "resumeReviewConfirmed"],
  ["streetAddress", "barangayDistrict", "cityMunicipality", "provinceState", "postalCode"],
  ["agree", "confirmAccurate"],
];

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [education, setEducation] = useState({ level: "", school: "", field: "", year: "", studying: false });
  const { autofillStatus, touched, handleResumeChange } = useResumeAutofill({ form, setForm, setEducation });
  const [eduError, setEduError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState(0);
  const captcha = useCaptcha();
  const formRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (submitted && !needsConfirmation) {
      const timer = setTimeout(() => navigate('/job-seeker'), 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, needsConfirmation, navigate]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }


  function handleNext() {
    const validationErrors = validate(form);
    const filtered = {};
    for (const key of Object.keys(validationErrors)) {
      if (STEP_FIELDS[step].includes(key)) filtered[key] = validationErrors[key];
    }
    setErrors(filtered);
    if (Object.keys(filtered).length > 0) {
      focusFirstError(firstErrorKey(filtered, null));
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function requestAccountCreation() {
    const validationErrors = validate(form);
    const eduValidationError = validateEducation(education);
    if (Object.keys(validationErrors).length > 0 || eduValidationError) {
      setErrors(validationErrors);
      setEduError(eduValidationError);
      focusFirstError(firstErrorKey(validationErrors, eduValidationError ? "education-level" : null));
      return;
    }
    setErrors({});
    setEduError("");
    if (captcha.required && !captcha.token) {
      setError("Please complete the verification challenge.");
      return;
    }
    setError("");
    setConfirmOpen(true);
  }

  async function finalizeAccount() {
    setBusy(true);
    setError("");
    try {
      const account = await signUp({ ...buildJobSeekerSignUpPayload(form, education), captchaToken: captcha.token });
      setNeedsConfirmation(!!account.emailConfirmationRequired);
      setSubmittedEmail(account.email);
      setSubmitted(true);
      setConfirmOpen(false);
    } catch (err) {
      captcha.reset();
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (step === TOTAL_STEPS - 1) {
      requestAccountCreation();
      return;
    }
    handleNext();
  }

  const inputClass = "w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";
  const labelClass = "block font-mono text-[11px] tracking-wider text-muted-foreground uppercase mb-1.5";
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
    return <JobSeekerRegisterSuccess needsConfirmation={needsConfirmation} submittedEmail={submittedEmail} />;
  }

  return (
    <>
      <SkipLink />
      <PublicShell>
      <div className="bg-muted/60">
      <div className="page-container py-10 sm:py-14">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-white p-6 md:p-10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              ← Back to roles
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
              JOB SEEKER
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Job Seeker Registration</h1>
            <p className="mt-2 text-sm text-muted-foreground">Fill in your details to create your verified municipal applicant account</p>
          </header>

          <p className="mb-4 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">Step {step + 1} of {TOTAL_STEPS}</p>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 register-form">
            {step === 0 && (
              <JobSeekerPersonalStep
                form={form}
                errors={errors}
                set={set}
                autofillStatus={autofillStatus}
                autofillTouched={touched}
                handleResumeChange={handleResumeChange}
                inputClass={inputClass}
                labelClass={labelClass}
                reqMark={reqMark}
              />
            )}

            {step === 1 && (
              <JobSeekerAddressStep
                form={form}
                errors={errors}
                set={set}
                inputClass={inputClass}
                labelClass={labelClass}
                reqMark={reqMark}
              />
            )}

            {step === 2 && (
              <>
                <JobSeekerBackgroundStep
                  form={form}
                  errors={errors}
                  set={set}
                  education={education}
                  setEducation={setEducation}
                  eduError={eduError}
                  setTermsOpen={setTermsOpen}
                  termsRead={termsRead}
                  reqMark={reqMark}
                />
                {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}
              </>
            )}

            {error && !confirmOpen && (
              <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            <div className="flex gap-3">
              {step > 0 && (
                <button type="button" onClick={handleBack} className="flex-1 min-h-[44px] px-6 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all">
                  Back
                </button>
              )}
              {step < TOTAL_STEPS - 1 && (
                <button key={step} type="button" onClick={handleNext} className="flex-1 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md">
                  Next
                </button>
              )}
              {step === TOTAL_STEPS - 1 && (
                <Button type="button" onClick={requestAccountCreation} disabled={busy} className="flex-1 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60">
                  {busy ? "Creating account…" : "Create Account"}
                </Button>
              )}
            </div>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline underline-offset-4 font-medium">
              Log in here
            </Link>
          </p>
        </div>
      </div>
      </div>
      </PublicShell>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onRead={() => setTermsRead(true)} />
      <RegistrationConfirmModal
        open={confirmOpen}
        error={error}
        busy={busy}
        title="Confirm account creation"
        description="Your account isn't active until you open the verification link and sign in."
        heading="What happens after you create your account"
        points={[
          "We email a verification link to the address you entered.",
          "Your account activates only after you open that link and sign in — the link expires in 1 hour.",
          "The details you entered are saved and applied to your profile automatically.",
        ]}
        note={(
          <>
            <strong className="font-semibold text-dark-blue">“Verified”</strong> means we confirmed the email belongs to you. Job seekers do not need PESO accreditation.
          </>
        )}
        confirmLabel="Confirm & Create Account"
        busyLabel="Creating account…"
        onConfirm={finalizeAccount}
        onCancel={() => { if (!busy) setConfirmOpen(false); }}
      />
    </>
  );
}

export default JobSeekerRegister;