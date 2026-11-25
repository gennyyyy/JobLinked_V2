import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "@/shared/services/auth";
import useCaptcha from "@/shared/hooks/useCaptcha";
import TermsModal from "@/shared/components/TermsModal";
import RegistrationConfirmModal from "./RegistrationConfirmModal";
import SkipLink from "@/shared/components/SkipLink";
import Turnstile from "@/shared/components/Turnstile";
import PublicShell from "@/shared/components/PublicShell";
import EmployerRegisterSuccess from "./EmployerRegisterSuccess";
import EmployerCompanyStep from "./EmployerCompanyStep";
import EmployerRepresentativeStep from "./EmployerRepresentativeStep";
import { validate, buildEmployerSignUpPayload } from "./employerRegistration";

const TOTAL_STEPS = 2;
const STEP0_FIELDS = ["companyName", "industry", "streetAddress", "barangayDistrict", "cityMunicipality", "provinceState", "postalCode", "contactNumber", "companyEmail", "password", "confirmPassword"];


const EMPTY_FORM = {
  companyName: "", industry: "", houseNumberUnit: "", streetAddress: "", subdivisionBuilding: "",
  barangayDistrict: "", cityMunicipality: "", provinceState: "", postalCode: "", contactNumber: "",
  companyEmail: "", password: "", confirmPassword: "",
  repFirstName: "", repMiddleName: "", repLastName: "", repSuffix: "", repPosition: "", repMobile: "", repEmail: "",
  agree: false, confirmAccurate: false,
};

function EmployerRegister() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [agree, setAgree] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState(0);
  const captcha = useCaptcha();
  const formRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (submitted && !needsConfirmation) {
      const timer = setTimeout(() => navigate('/employer'), 1500);
      return () => clearTimeout(timer);
    }
  }, [submitted, needsConfirmation, navigate]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function syncAgree(value) {
    setAgree(value);
    setForm((prev) => ({ ...prev, agree: value }));
    setErrors((prev) => (prev.agree ? { ...prev, agree: undefined } : prev));
  }

  function getValues() {
    return { ...form, agree };
  }

  function handleNext() {
    const values = getValues();
    const validationErrors = validate(values);
    const filtered = {};
    for (const key of Object.keys(validationErrors)) {
      if (STEP0_FIELDS.includes(key)) filtered[key] = validationErrors[key];
    }
    setErrors(filtered);
    if (Object.keys(filtered).length > 0) {
      focusFirstError(firstErrorKey(filtered));
      return;
    }
    setStep(1);
  }

  function handleBack() {
    setStep(0);
  }

  function requestSubmission() {
    const values = getValues();
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
    setError("");
    setConfirmOpen(true);
  }

  async function finalizeSubmission() {
    const values = getValues();
    setBusy(true);
    setError("");
    try {
      const account = await signUp({ ...buildEmployerSignUpPayload(values), captchaToken: captcha.token });
      setSubmittedEmail(account.email || "");
      setNeedsConfirmation(!!account.emailConfirmationRequired);
      setSubmitted(true);
      setConfirmOpen(false);
    } catch (err) {
      captcha.reset(); // single-use token: the next attempt needs a fresh one
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (step === TOTAL_STEPS - 1) {
      requestSubmission();
      return;
    }
    handleNext();
  }

  if (submitted) {
    return <EmployerRegisterSuccess needsConfirmation={needsConfirmation} submittedEmail={submittedEmail} />;
  }

  const inputClass = "form-field";
  const labelClass = "block font-mono text-xs tracking-wider text-muted-foreground uppercase mb-1.5";
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
        <div className="mx-auto w-full max-w-4xl rounded-panel border bg-card p-6 md:p-10 shadow-surface">
          <div className="flex items-center justify-between mb-4">
            <Link to="/register" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              ← Back to roles
            </Link>
            <span className="font-mono text-micro tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
              EMPLOYER ACCREDITATION
            </span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Business Registration</h1>
            <p className="mt-2 text-sm text-muted-foreground">Submit business details and compliance credentials for Santa Maria PESO accreditation</p>
            <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">Accreditation takes about 3 business days.</p>
          </header>

          <p className="mb-4 font-mono text-xs tracking-widest uppercase text-muted-foreground">Step {step + 1} of {TOTAL_STEPS}</p>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 register-form">
            {step === 0 && (
              <EmployerCompanyStep
                errors={errors}
                setErrors={setErrors}
                inputClass={inputClass}
                labelClass={labelClass}
                reqMark={reqMark}
                form={form}
                set={set}
              />
            )}

            {step === 1 && (
              <>
                <EmployerRepresentativeStep
                  errors={errors}
                  setErrors={setErrors}
                  inputClass={inputClass}
                  labelClass={labelClass}
                  reqMark={reqMark}
                  form={form}
                  set={set}
                />

                {error && !confirmOpen && (
                  <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>
                )}

                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <input id="agree" type="checkbox" name="agree" checked={agree} disabled={!termsRead} onChange={(e) => syncAgree(e.target.checked)} className="size-4 shrink-0 accent-primary disabled:opacity-50 disabled:cursor-not-allowed" />
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
                      checked={!!form.confirmAccurate}
                      aria-invalid={!!errors.confirmAccurate}
                      aria-describedby={errors.confirmAccurate ? "confirmAccurate-error" : undefined}
                      onChange={(e) => set("confirmAccurate", e.target.checked)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span>I confirm that all the information I provided is true and correct to the best of my knowledge.{reqMark}</span>
                  </Label>
                  {errors.confirmAccurate && <p id="confirmAccurate-error" role="alert" className="mt-1 text-xs text-danger">{errors.confirmAccurate}</p>}
                </div>

                {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}

                <div className="flex gap-3">
                  <Button type="button" onClick={handleBack} className="flex-1 min-h-[44px] px-6 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all">
                    Back
                  </Button>
                  <Button type="button" onClick={requestSubmission} disabled={busy} className="flex-1 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60">
                    {busy ? "Submitting…" : "Submit Accreditation Application"}
                  </Button>
                </div>
              </>
            )}

            {step === 0 && (
              <div className="flex gap-3">
                <Button type="button" onClick={handleNext} className="flex-1 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md">
                  Next
                </Button>
              </div>
            )}
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
      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onRead={() => setTermsRead(true)}
        onAccept={() => syncAgree(true)}
      />
      <RegistrationConfirmModal
        open={confirmOpen}
        error={error}
        busy={busy}
        title="Confirm accreditation submission"
        description="Your employer account isn't active until you verify the company email and sign in."
        heading="What happens after you submit"
        points={[
          "We email a verification link to the official company email you entered.",
          "Your account activates only after you open that link and sign in — the link expires in 1 hour.",
          "Once verified, PESO reviews your accreditation — usually within 3 business days. You can post jobs after approval.",
        ]}
        note={(
          <>
            <strong className="font-semibold text-dark-blue">“Verified”</strong> means we confirmed the email belongs to you. It is not PESO accreditation — that review happens separately.
          </>
        )}
        confirmLabel="Confirm & Submit Application"
        busyLabel="Submitting…"
        onConfirm={finalizeSubmission}
        onCancel={() => { if (!busy) setConfirmOpen(false); }}
      />
    </>
  );
}

export default EmployerRegister;