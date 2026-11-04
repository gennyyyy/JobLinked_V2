"use client";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Search, ShieldCheck, Loader2, } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction, } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, } from "@/components/ui/alert-dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent, } from "@/components/ui/empty";
import { Field, FieldLabel, FieldError, FieldDescription, } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/shared/lib/routeLoaders";
import logoImage from "@/assets/logo-256.png";
import wordmarkImage from "@/assets/wordmark-400.png";
export function Logo({ light = false, compact = false, imageSrc = logoImage, wordmarkSrc = wordmarkImage, }) {
    // Local brand marks: the same files the public header ships, so no page
    // depends on a third-party blob host for its logo.
    return (<Link to="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="JobLinked home">
      {compact ? (<img src={imageSrc} alt="" width={256} height={256} decoding="async" className="size-9 shrink-0 rounded-full object-cover"/>) : (<>
          <img src={imageSrc} alt="JobLinked logo" width={256} height={256} decoding="async" className="size-11 shrink-0 rounded-full object-cover"/>
          <img src={wordmarkSrc} alt="JobLinked" width={400} height={133} decoding="async" className="h-auto w-[150px] object-contain"/>
        </>)}
      {!imageSrc && (<span className={cn("text-[23px] font-bold tracking-[-1px] text-navy", light && "text-white")}>
          Job
          <span className={cn("text-primary", light && "text-white")}>
            Linked
          </span>
          <span className="ml-0.5 text-primary">.</span>
        </span>)}
    </Link>);
}
export function LinkButton({ href, children, variant = "default", className, ...props }) {
    // Warm the destination chunk while the pointer is still travelling.
    const warm = () => prefetchRoute(href);
    return (<Link to={href} onMouseEnter={warm} onFocus={warm} className={cn(buttonVariants({ variant }), "min-h-11 gap-2 px-5", className)} {...props}>
      {children}
    </Link>);
}
export function VerifiedBadge({ label = "Verified employer", }) {
    return (<Badge variant="secondary" className="gap-1 bg-teal-soft text-teal">
      <ShieldCheck data-icon="inline-start"/>
      {label}
    </Badge>);
}
export function StatusBadge({ status }) {
    const good = ["Approved", "Published", "Hired", "Active"].includes(status);
    const pending = [
        "Pending Review",
        "Under Review",
        "Resubmission Requested",
        "Draft",
    ].includes(status);
    const bad = ["Rejected", "Removed", "Flagged", "Suspended"].includes(status);
    return (<Badge variant="secondary" className={cn("whitespace-nowrap", good && "bg-success-soft text-success", pending && "bg-warning-soft text-warning", bad && "bg-danger-soft text-destructive", !good && !pending && !bad && "bg-blue-soft text-primary")}>
      {status}
    </Badge>);
}
export function Panel({ title, description, action, children, footer, className, }) {
    return (<Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>);
}
export function PageHeading({ title, description, action, eyebrow, }) {
    return (<div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-[30px]">
          {title}
        </h1>
        {description && (<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>)}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>);
}
export function Notice({ title = "Information", children, warning = false, }) {
    return (<Alert className={cn("border-primary/10 bg-blue-soft text-navy", warning && "border-warning/15 bg-warning-soft")}>
      <ShieldCheck />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-inherit/75">
        {children}
      </AlertDescription>
    </Alert>);
}
export function EmptyState({ title = "No results found", description = "Try another search or adjust your filters.", href, label = "Browse jobs", action, }) {
    return (<Empty className="min-h-56 rounded-xl border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {(href || action) && (<EmptyContent>
          {href ? (<LinkButton href={href}>
              {label}
              <ArrowRight className="size-4"/>
            </LinkButton>) : (action)}
        </EmptyContent>)}
    </Empty>);
}
export function StatCards({ stats, }) {
    return (<div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, note, tone }) => (<div className="surface flex flex-col gap-4" key={label}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Icon className={cn("size-[18px] text-primary", tone === "teal" && "text-teal")}/>
          </div>
          <div>
            <p className="text-[29px] font-semibold leading-none tracking-tight text-navy">
              {value}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {note ?? "Current records"}
            </p>
          </div>
        </div>))}
    </div>);
}
export function ConfirmButton({ children, title, description, onConfirm, variant = "destructive", className, }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    return (<>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
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
            <AlertDialogAction variant={variant} disabled={busy} onClick={async () => {
            setBusy(true);
            try {
                await onConfirm();
                setOpen(false);
            }
            finally {
                setBusy(false);
            }
        }}>
              {busy && (<Loader2 data-icon="inline-start" className="animate-spin"/>)}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);
}
export function TextField({ label, error, help, multiline, ...props }) {
    const fieldId = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
    return (<Field data-invalid={!!error}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {props.required && <span className="text-destructive">*</span>}
      </FieldLabel>
      {multiline ? (<Textarea {...props} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}/>) : (<Input {...props} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}/>)}
      {help && (<FieldDescription id={`${fieldId}-help`}>{help}</FieldDescription>)}
      {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
    </Field>);
}
export function SelectField({ label, options, placeholder, error, ...props }) {
    const fieldId = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
    return (<Field data-invalid={!!error}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <select {...props} id={fieldId} className={cn("form-select", props.className)} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((item) => {
            const option = typeof item === "string" ? { label: item, value: item } : item;
            return (<option key={option.value} value={option.value}>
              {option.label}
            </option>);
        })}
      </select>
      {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
    </Field>);
}
export function CompanyMark({ initials, color = "blue", large = false, }) {
    return (<span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold tracking-tight", `company-${color}`, large && "size-16 rounded-2xl text-3xl")}>
      {initials}
    </span>);
}
export function SuccessMark() {
    return (<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
      <CheckCircle2 className="size-8"/>
    </div>);
}
