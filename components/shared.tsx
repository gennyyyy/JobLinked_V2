"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Search,
  ShieldCheck,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Logo({
  light = false,
  compact = false,
  imageSrc = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-lDM9L9yQL9F0cRDvGXNMeT2vrETT2m.png",
  wordmarkSrc = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/TextBased%20Logo-VbwcOtvFwkjScF5hxpbierATwB6ncj.png",
}: {
  light?: boolean;
  compact?: boolean;
  imageSrc?: string;
  wordmarkSrc?: string;
}) {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5"
      aria-label="JobLinked home"
    >
      {compact ? (
        <img src={imageSrc} alt="" width={64} height={64} className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <>
          <img src={imageSrc} alt="JobLinked logo" width={64} height={64} className="size-11 shrink-0 rounded-full object-cover" />
          <img src={wordmarkSrc} alt="JobLinked" width={211} height={60} className="h-auto w-[150px] object-contain" />
        </>
      )}
      {!imageSrc && (
        <span
          className={cn(
            "text-[23px] font-bold tracking-[-1px] text-navy",
            light && "text-white",
          )}
        >
          Job
          <span className={cn("text-primary", light && "text-white")}>
            Linked
          </span>
          <span className="ml-0.5 text-primary">.</span>
        </span>
      )}
    </Link>
  );
}
export function LinkButton({
  href,
  children,
  variant = "default",
  className,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant }),
        "min-h-11 gap-2 px-5",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
export function VerifiedBadge({
  label = "Verified employer",
}: {
  label?: string;
}) {
  return (
    <Badge variant="secondary" className="gap-1 bg-teal-soft text-teal">
      <ShieldCheck data-icon="inline-start" />
      {label}
    </Badge>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const good = ["Approved", "Published", "Hired", "Active"].includes(status);
  const pending = [
    "Pending Review",
    "Under Review",
    "Resubmission Requested",
    "Draft",
  ].includes(status);
  const bad = ["Rejected", "Removed", "Flagged", "Suspended"].includes(status);
  return (
    <Badge
      variant="secondary"
      className={cn(
        "whitespace-nowrap",
        good && "bg-success-soft text-success",
        pending && "bg-warning-soft text-warning",
        bad && "bg-danger-soft text-destructive",
        !good && !pending && !bad && "bg-blue-soft text-primary",
      )}
    >
      {status}
    </Badge>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
export function PageHeading({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}
export function Notice({
  title = "Information",
  children,
  warning = false,
}: {
  title?: string;
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <Alert
      className={cn(
        "border-primary/10 bg-blue-soft text-navy",
        warning && "border-warning/15 bg-warning-soft",
      )}
    >
      <ShieldCheck />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-inherit/75">
        {children}
      </AlertDescription>
    </Alert>
  );
}
export function EmptyState({
  title = "No results found",
  description = "Try another search or adjust your filters.",
  href,
  label = "Browse jobs",
  action,
}: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="min-h-56 rounded-xl border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {(href || action) && (
        <EmptyContent>
          {href ? (
            <LinkButton href={href}>
              {label}
              <ArrowRight className="size-4" />
            </LinkButton>
          ) : (
            action
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}
export function StatCards({
  stats,
}: {
  stats: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    note?: string;
    tone?: "blue" | "teal";
  }[];
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, note, tone }) => (
        <div className="surface flex flex-col gap-4" key={label}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Icon
              className={cn(
                "size-[18px] text-primary",
                tone === "teal" && "text-teal",
              )}
            />
          </div>
          <div>
            <p className="text-[29px] font-semibold leading-none tracking-tight text-navy">
              {value}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {note ?? "Current records"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
export function ConfirmButton({
  children,
  title,
  description,
  onConfirm,
  variant = "destructive",
  className,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  onConfirm: () => Promise<unknown> | void;
  variant?: "destructive" | "outline" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={variant}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
export function TextField({
  label,
  error,
  help,
  multiline,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  help?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const fieldId =
    props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {props.required && <span className="text-destructive">*</span>}
      </FieldLabel>
      {multiline ? (
        <Textarea
          {...(props as React.ComponentProps<typeof Textarea>)}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined
          }
        />
      ) : (
        <Input
          {...props}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined
          }
        />
      )}
      {help && (
        <FieldDescription id={`${fieldId}-help`}>{help}</FieldDescription>
      )}
      {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
    </Field>
  );
}
export function SelectField({
  label,
  options,
  placeholder,
  error,
  ...props
}: React.ComponentProps<"select"> & {
  label: string;
  options: string[] | { label: string; value: string }[];
  placeholder?: string;
  error?: string;
}) {
  const fieldId =
    props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <select
        {...props}
        id={fieldId}
        className={cn("form-select", props.className)}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((item) => {
          const option =
            typeof item === "string" ? { label: item, value: item } : item;
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
      {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
    </Field>
  );
}
export function CompanyMark({
  initials,
  color = "blue",
  large = false,
}: {
  initials: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold tracking-tight",
        `company-${color}`,
        large && "size-16 rounded-2xl text-3xl",
      )}
    >
      {initials}
    </span>
  );
}
export function SuccessMark() {
  return (
    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
      <CheckCircle2 className="size-8" />
    </div>
  );
}
