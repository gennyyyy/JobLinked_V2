import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "@/shared/services/auth";
import useCaptcha from "@/shared/hooks/useCaptcha";
import TermsModal from "@/shared/components/TermsModal";
import SkipLink from "@/shared/components/SkipLink";
import Turnstile from "@/shared/components/Turnstile";
import PublicShell from "@/shared/components/PublicShell";
import EmployerRegisterSuccess from "./EmployerRegisterSuccess";
import EmployerCompanyStep from "./EmployerCompanyStep";
import EmployerRepresentativeStep from "./EmployerRepresentativeStep";
import { validate, buildEmployerSignUpPayload } from "./employerRegistration";

function EmployerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [agree, setAgree] = useState(false);
  const captcha = useCaptcha();
  const formRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (submitted && !needsConfirmation) {
      const timer = setTimeout(() => navigate('/employer'), 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, needsConfirmation, navigate]);

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
    if (captcha.required && !captcha.token) {
      setError("Please complete the verification challenge.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const account = await signUp({ ...buildEmployerSignUpPayload(values), captchaToken: captcha.token });

      if (account.emailConfirmationRequired) {
        setNeedsConfirmation(true);
        setSubmitted(true);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      captcha.reset(); // single-use token: the next attempt needs a fresh one
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return <EmployerRegisterSuccess needsConfirmation={needsConfirmation} />;
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
              EMPLOYER ACCREDITATION
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Business Registration</h1>
            <p className="mt-2 text-sm text-muted-foreground">Submit business details and compliance credentials for Santa Maria PESO accreditation</p>
          </header>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 register-form">
            <EmployerCompanyStep
              errors={errors}
              setErrors={setErrors}
              inputClass={inputClass}
              labelClass={labelClass}
              reqMark={reqMark}
            />

            <EmployerRepresentativeStep
              errors={errors}
              setErrors={setErrors}
              inputClass={inputClass}
              labelClass={labelClass}
              reqMark={reqMark}
            />

            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
            )}

            <div className="text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <input id="agree" type="checkbox" name="agree" checked={agree} disabled={!termsRead} onChange={(e) => { setAgree(e.target.checked); if (errors.agree) setErrors((prev) => ({ ...prev, agree: undefined })); }} className="size-4 shrink-0 accent-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                <Label htmlFor="agree" className={!termsRead ? "cursor-not-allowed opacity-70" : "cursor-pointer"}>I agree to the municipal data collection terms and PESO privacy policies.{reqMark}</Label>
              </div>
              <div className="ml-[26px] mt-0.5">
                <button type="button" onClick={() => setTermsOpen(true)} className="text-xs leading-4 text-primary hover:underline underline-offset-4">View terms</button>
                {!termsRead && <p className="mt-0.5 text-muted-foreground">Please open and read the terms before agreeing.</p>}
              </div>
              {errors.agree && <p className="mt-1 text-danger">{errors.agree}</p>}
            </div>

            <div data-invalid={!!errors.confirmAccurate}>
              <Label htmlFor="confirmAccurate" className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <input
                  id="confirmAccurate"
                  name="confirmAccurate"
                  type="checkbox"
                  required
                  aria-invalid={!!errors.confirmAccurate}
                  aria-describedby={errors.confirmAccurate ? "confirmAccurate-error" : undefined}
                  onChange={() => {
                    if (errors.confirmAccurate) setErrors((prev) => ({ ...prev, confirmAccurate: undefined }));
                  }}
                  className="size-4 shrink-0 accent-primary"
                />
                <span>I confirm that all the information I provided is true and correct to the best of my knowledge.{reqMark}</span>
              </Label>
              {errors.confirmAccurate && <p id="confirmAccurate-error" role="alert" className="mt-1 text-xs text-danger">{errors.confirmAccurate}</p>}
            </div>

            {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}

            <Button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit Accreditation Application"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already verified?{" "}
            <Link to="/login" className="text-primary hover:underline underline-offset-4 font-medium">
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

export default EmployerRegister;
