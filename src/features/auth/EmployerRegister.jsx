import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { normalizePhone, isValidPhone } from "@/shared/utils/phone";

function validate(values) {
  const e = {};
  if (!values.companyName?.trim()) e.companyName = "Company name is required";
  if (!values.industry?.trim()) e.industry = "Industry is required";
  if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
  if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
  if (!values.provinceState?.trim()) e.provinceState = "Province is required";
  if (values.postalCode?.trim() && !/^\d{4}$/.test(values.postalCode.trim())) e.postalCode = "Postal code must be 4 digits";
  if (!values.contactNumber?.trim()) e.contactNumber = "Contact number is required";
  else if (!isValidPhone(values.contactNumber)) e.contactNumber = "Enter a valid number (e.g. 44 000 0000)";
  if (!values.companyEmail?.trim()) e.companyEmail = "Company email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) e.companyEmail = "Invalid email address";
  if (!values.repFirstName?.trim()) e.repFirstName = "First name is required";
  if (!values.repLastName?.trim()) e.repLastName = "Last name is required";
  if (!values.repPosition?.trim()) e.repPosition = "Position is required";
  if (!values.repEmail?.trim()) e.repEmail = "Representative email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.repEmail)) e.repEmail = "Invalid email address";
  if (!values.repMobile?.trim()) e.repMobile = "Representative mobile is required";
  else if (!isValidPhone(values.repMobile)) e.repMobile = "Enter a valid number (e.g. 917 123 4567)";
  if (!values.repBirthdate) e.repBirthdate = "Birthday is required";
  if (!values.password) e.password = "Password is required";
  else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
  if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
  else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
  if (!values.agree) e.agree = "You must agree to the terms";
  return e;
}

function buildEmployerSignUpPayload(values) {
  return {
    email: values.companyEmail.trim(),
    password: values.password,
    role: "employer",
    firstName: values.repFirstName.trim(),
    middleName: values.repMiddleName?.trim() || "",
    lastName: values.repLastName.trim(),
    suffix: values.repSuffix?.trim() || "",
    extra: {
      phone: normalizePhone(values.repMobile),
      birthdate: values.repBirthdate,
      companyName: values.companyName.trim(),
      industry: values.industry.trim(),
      companyEmail: values.companyEmail.trim(),
      representativeEmail: values.repEmail.trim(),
      representativePosition: values.repPosition.trim(),
      houseNumberUnit: values.houseNumberUnit?.trim() || "",
      streetAddress: values.streetAddress.trim(),
      subdivisionBuilding: values.subdivisionBuilding?.trim() || "",
      barangayDistrict: values.barangayDistrict?.trim() || "",
      cityMunicipality: values.cityMunicipality.trim(),
      provinceState: values.provinceState.trim(),
      postalCode: values.postalCode?.trim() || "",
      country: "Philippines",
    },
  };
}

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

            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Input id="agree" type="checkbox" name="agree" checked={agree} disabled={!termsRead} onChange={(e) => { setAgree(e.target.checked); if (errors.agree) setErrors((prev) => ({ ...prev, agree: undefined })); }} className="mt-0.5 accent-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" />
              <div>
                <Label htmlFor="agree" className={!termsRead ? "cursor-not-allowed opacity-70" : "cursor-pointer"}>I agree to the municipal data collection terms and PESO privacy policies.{reqMark}</Label>
                <Button type="button" onClick={() => setTermsOpen(true)} className="ml-1 whitespace-nowrap text-primary hover:underline underline-offset-4">View terms</Button>
                {!termsRead && <p className="mt-1 text-muted-foreground">Please open and read the terms before agreeing.</p>}
                {errors.agree && <p className="text-danger text-xs mt-1">{errors.agree}</p>}
              </div>
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
