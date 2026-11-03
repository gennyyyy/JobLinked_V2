"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  Users,
  Check,
  FileCheck2,
  MapPin,
  Loader2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, ROLE_LABELS } from "@/constants";
import {
  LinkButton,
  TextField,
  Notice,
  SuccessMark,
} from "@/components/shared";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";

function AuthFrame({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="bg-muted/60">
      <div className="page-container py-10 sm:py-14">
        <div className="mx-auto grid max-w-[1020px] overflow-hidden rounded-2xl border bg-white lg:grid-cols-[.85fr_1fr]">
          <aside className="relative hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
            <div>
              <span className="flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <BriefcaseIcon />
              </span>
              <p className="mt-10 text-[10px] font-medium tracking-[.15em] text-white/55 uppercase">
                Local talent. Local opportunities.
              </p>
              <h2 className="mt-4 text-[36px] font-semibold leading-tight tracking-[-.04em] text-white">
                Your next chapter
                <br />
                could start
                <br />
                close to home.
              </h2>
              <p className="mt-5 text-xs leading-7 text-white/65">
                A simpler way to find meaningful work, build great teams, and
                connect our community.
              </p>
              <div className="mt-9 flex flex-col gap-5">
                {[
                  [ShieldCheck, "Verified local employers"],
                  [FileCheck2, "Applications, organized"],
                  [Users, "A community-first approach"],
                ].map(([Icon, text]) => {
                  const I = Icon as typeof ShieldCheck;
                  return (
                    <div
                      key={text as string}
                      className="flex items-center gap-3 text-xs text-white/85"
                    >
                      <I className="size-4 text-[#8edbd1]" />
                      {text as string}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-14">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <MapPin className="size-3.5" />
                Santa Maria, Bulacan
              </div>
              <p className="mt-5 border-t border-white/15 pt-5 text-[10px] leading-6 text-white/50">
                Independent frontend prototype.
                <br />
                Not an official government service.
              </p>
            </div>
          </aside>
          <div className="p-6 sm:p-10">
            <h1 className="text-[29px] font-semibold tracking-[-.04em]">
              {title}
            </h1>
            <p className="mb-7 mt-2 text-xs leading-6 text-muted-foreground">
              {subtitle}
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
function BriefcaseIcon() {
  return <Building2 className="size-6" />;
}
const loginSchema = z.object({
  email: z.email("Enter a valid sample email address."),
  password: z.string().min(1, "Enter the sample password."),
});
export function LoginPage({ nextPath }: { nextPath?: string }) {
  const { api } = useDemo();
  const { pending } = useAction();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <AuthFrame
      title="Welcome back."
      subtitle="A new opportunity could be waiting for you."
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          try {
            const result = await api.login(
              values.email,
              values.password,
              remember,
            );
            router.push(
              nextPath?.startsWith("/jobs/") && !nextPath.includes("//")
                ? nextPath
                : `/${result.user.role === "staff" ? "admin" : result.user.role}/dashboard`,
            );
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Could not open the demo account.",
            );
          } finally {
            setBusy(false);
          }
        })}
      >
        <FieldGroup>
          <TextField
            label="Email address"
            type="email"
            autoComplete="username"
            placeholder="Choose a sample account below"
            {...form.register("email")}
            error={form.formState.errors.email?.message}
          />
          <Field data-invalid={!!form.formState.errors.password}>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="login-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter the demo password"
                {...form.register("password")}
                aria-invalid={!!form.formState.errors.password}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  size="icon-sm"
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </Field>
        </FieldGroup>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-demo"
              checked={remember}
              onCheckedChange={setRemember}
            />
            <label
              htmlFor="remember-demo"
              className="text-[11px] text-muted-foreground"
            >
              Remember demo role
            </label>
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-[11px] font-medium text-primary"
          >
            Forgot password?
          </Link>
        </div>
        {error && (
          <p role="alert" className="text-xs leading-6 text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || pending}>
          {busy ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : null}
          Open demo portal
          <ArrowRight data-icon="inline-end" />
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] text-muted-foreground">
          Choose a fictional demo account
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-medium text-navy transition-colors hover:border-primary/40 hover:bg-blue-soft"
            type="button"
            key={a.id}
            onClick={() => {
              form.setValue("email", a.email);
              form.setValue("password", DEMO_PASSWORD);
              setError("");
            }}
          >
            {a.role === "jobseeker" ? (
              <Users className="size-4 text-primary" />
            ) : a.role === "employer" ? (
              <Building2 className="size-4 text-primary" />
            ) : (
              <ShieldCheck className="size-4 text-primary" />
            )}
            {ROLE_LABELS[a.role]}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-[10px] leading-6 text-muted-foreground">
        <p>
          Sample password:{" "}
          <code className="font-semibold text-navy">{DEMO_PASSWORD}</code>
        </p>
        <p>
          No real passwords, secure sessions, or JWTs are created. Only a
          fictional role identifier can be remembered.
        </p>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        New to JobLinked?{" "}
        <Link href="/signup" className="font-medium text-primary">
          Start your next chapter
        </Link>
      </p>
    </AuthFrame>
  );
}
export function RoleSelectionPage() {
  return (
    <div className="bg-muted/60">
      <div className="page-container py-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-9 text-center">
            <p className="eyebrow mb-3">A place for your next chapter</p>
            <h1 className="text-4xl font-semibold tracking-[-.045em]">
              How can we help you grow?
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Choose the journey that feels right for you.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: Users,
                title: "I’m looking for work",
                desc: "Find opportunities that fit your skills and your life.",
                items: [
                  "Discover verified local vacancies",
                  "Create one organized profile",
                  "Apply and track every update",
                ],
                href: "/signup/jobseeker",
                label: "Join as a job seeker",
              },
              {
                icon: Building2,
                title: "I’m building a team",
                desc: "Connect with motivated talent in your community.",
                items: [
                  "Register and submit accreditation",
                  "Post jobs after PESO demo approval",
                  "Manage candidates in one place",
                ],
                href: "/signup/employer",
                label: "Join as an employer",
              },
            ].map(({ icon: Icon, title, desc, items, href, label }) => (
              <div className="surface flex flex-col p-7" key={href}>
                <span className="soft-icon">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-6 text-xl font-semibold">{title}</h2>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  {desc}
                </p>
                <ul className="my-7 flex flex-col gap-3">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-xs text-muted-foreground"
                    >
                      <Check className="size-4 shrink-0 text-teal" />
                      {item}
                    </li>
                  ))}
                </ul>
                <LinkButton href={href} className="mt-auto">
                  {label}
                  <ArrowRight className="size-4" />
                </LinkButton>
              </div>
            ))}
          </div>
          <div className="mt-7">
            <Notice title="PESO administrator access is provisioned">
              There is no public administrator registration. Authorized
              personnel would receive access from the responsible organization.
              To explore this prototype, use the labeled PESO demo account on
              the login page.
            </Notice>
          </div>
          <p className="mt-7 text-center text-xs text-muted-foreground">
            Already have a demo account?{" "}
            <Link className="font-medium text-primary" href="/login">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
const forgotSchema = z.object({
  email: z.email("Enter a valid sample email address."),
});
const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The passwords do not match.",
    path: ["confirm"],
  });
export function RecoveryPage({ reset = false }: { reset?: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const forgot = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const password = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  return (
    <AuthFrame
      title={reset ? "A fresh start." : "Let’s get you back on track."}
      subtitle={
        reset
          ? "Preview a validated password reset form."
          : "Preview the account recovery experience."
      }
    >
      {submitted ? (
        <div className="flex flex-col gap-5">
          <SuccessMark />
          <Notice
            title={
              reset ? "Demo validation completed" : "Recovery preview ready"
            }
          >
            {reset
              ? "The form is valid, but no password was changed. The sample password remains Demo123!."
              : "A production service would send a time-limited recovery link. No email was sent and no account was looked up in this demo."}
          </Notice>
          <LinkButton href={reset ? "/login" : "/reset-password"}>
            {reset ? "Back to demo login" : "Preview reset password"}
            <ArrowRight className="size-4" />
          </LinkButton>
        </div>
      ) : reset ? (
        <form
          onSubmit={password.handleSubmit(() => {
            password.reset();
            setSubmitted(true);
          })}
        >
          <FieldGroup>
            <TextField
              label="New sample password"
              type="password"
              autoComplete="new-password"
              {...password.register("password")}
              error={password.formState.errors.password?.message}
              help="At least 8 characters, an uppercase letter, and a number. Do not use a real password."
            />
            <TextField
              label="Confirm sample password"
              type="password"
              autoComplete="new-password"
              {...password.register("confirm")}
              error={password.formState.errors.confirm?.message}
            />
            <Button type="submit">
              <KeyRound data-icon="inline-start" />
              Validate demo reset
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={forgot.handleSubmit(() => setSubmitted(true))}>
          <FieldGroup>
            <TextField
              label="Sample email address"
              type="email"
              placeholder="you@example.com"
              {...forgot.register("email")}
              error={forgot.formState.errors.email?.message}
            />
            <Button type="submit">
              Preview recovery request
              <ArrowRight data-icon="inline-end" />
            </Button>
          </FieldGroup>
        </form>
      )}
      <p className="mt-6 text-center text-xs">
        <Link href="/login" className="text-primary">
          Return to login
        </Link>
      </p>
    </AuthFrame>
  );
}
