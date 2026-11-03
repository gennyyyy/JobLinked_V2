import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "@/shared/services/auth";
import TermsModal from "@/shared/components/TermsModal";
import SkipLink from "@/shared/components/SkipLink";
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

function JobSeekerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  // Optional education is stored with signup metadata and provisioned after
  // email verification when a session becomes available.
  const [education, setEducation] = useState({ level: "", school: "", field: "", year: "", studying: false });
  const { autofillStatus, handleResumeChange } = useResumeAutofill({ setForm, setEducation });
  const [eduError, setEduError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const formRef = useRef(null);
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

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validate(form);
    const eduValidationError = validateEducation(education);
    if (Object.keys(validationErrors).length > 0 || eduValidationError) {
      setErrors(validationErrors);
      setEduError(eduValidationError);
      focusFirstError(firstErrorKey(validationErrors, eduValidationError ? "educationLevel" : null));
      return;
    }
    setErrors({});
    setEduError("");
    setBusy(true);
    setError("");
    try {
      const account = await signUp(buildJobSeekerSignUpPayload(form, education));
      setNeedsConfirmation(!!account.emailConfirmationRequired);
      setSubmittedEmail(account.email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
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

  // First error in visual (DOM) order, so scroll never jumps past an
  // empty field above to a later one (e.g. birthday skipped for email).
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
        <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-white p-6 md:p-10 shadow-sm">
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

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 register-form">
            <JobSeekerPersonalStep
              form={form}
              errors={errors}
              set={set}
              autofillStatus={autofillStatus}
              handleResumeChange={handleResumeChange}
              inputClass={inputClass}
              labelClass={labelClass}
              reqMark={reqMark}
            />

            <JobSeekerAddressStep
              form={form}
              errors={errors}
              set={set}
              inputClass={inputClass}
              labelClass={labelClass}
              reqMark={reqMark}
            />

            <JobSeekerBackgroundStep
              form={form}
              errors={errors}
              set={set}
              education={education}
              setEducation={setEducation}
              eduError={eduError}
              setTermsOpen={setTermsOpen}
              termsRead={termsRead}
              labelClass={labelClass}
              reqMark={reqMark}
            />

            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already registered?{" "}
            <Link to="/job-seeker/login" className="text-primary hover:underline underline-offset-4 font-medium">
              Log in here
            </Link>
          </p>
        </div>
      </div>
      </div>
      </PublicShell>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onRead={() => setTermsRead(true)} />
    </>
  );
}

export default JobSeekerRegister;
