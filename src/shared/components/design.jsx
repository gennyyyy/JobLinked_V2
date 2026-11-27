"use client";
import { Link } from "react-router-dom";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, CheckCircle2, ChevronDown, Search, ShieldCheck, } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction, } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent, } from "@/components/ui/empty";
import { Field, FieldLabel, FieldError, FieldDescription, } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
      {!imageSrc && (<span className={cn("text-2xl font-bold tracking-[-1px] text-navy", light && "text-white")}>
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
    // Raw values arrive as `active` / `under_review` / `Pending Review`; normalize once.
    const key = String(status ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    const label = key.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    const good = ["approved", "published", "hired", "active", "accepted", "placed"].includes(key);
    const pending = [
        "pending review",
        "under review",
        "resubmission requested",
        "draft",
        "pending",
    ].includes(key);
    const bad = ["rejected", "removed", "flagged", "suspended", "revoked"].includes(key);
    return (<Badge variant="secondary" className={cn("whitespace-nowrap", good && "bg-success-soft text-success", pending && "bg-warning-soft text-warning", bad && "bg-danger-soft text-destructive", !good && !pending && !bad && "bg-blue-soft text-primary")}>
      {label}
    </Badge>);
}
export function Panel({ title, description, action, children, footer, className, id, contentClassName, contentProps, size = 'default', }) {
    const derived = contentClassName
        ? { tabIndex: 0, role: 'region', 'aria-label': `${title} content`, ...contentProps }
        : (contentProps ?? {})
    return (<Card id={id} size={size} className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName} {...derived}>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>);
}
export function PageHeading({ title, description, action, eyebrow, compact = false, }) {
    return (<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-3xl">
          {title}
        </h1>
        {description && (<p className={cn("max-w-2xl text-sm text-muted-foreground", compact ? "mt-1.5 leading-5" : "mt-2 leading-6")}>
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
export function EmptyState({ title = "No results found", description = "Try another search or adjust your filters.", href, label = "Browse jobs", action, className, }) {
    return (<Empty className={cn("min-h-56 rounded-xl border bg-card", className)}>
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
export function SearchInput({ value, onChange, placeholder = "Search records…", label = "Search records", className, }) {
    // Shared list-page search field: sr-only label + input-group with a search
    // icon, matching the reference list controls.
    const id = useId();
    return (<div className={cn("min-w-0 flex-1", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <InputGroup>
        <InputGroupInput id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
    </div>);
}
export function StatCards({ stats, countUp = false, }) {
    return (<div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, note, tone }) => (<div className="surface flex flex-col gap-4" key={label}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Icon className={cn("size-[18px] text-primary", tone === "teal" && "text-teal")}/>
          </div>
          <div>
            {countUp && typeof value === "number" && Number.isFinite(value) ? (<CountUp value={value} className="text-3xl font-semibold leading-none tracking-tight text-navy"/>) : (<p className="text-3xl font-semibold leading-none tracking-tight text-navy">
              {value}
            </p>)}
            <p className="mt-2 text-micro text-muted-foreground">
              {note ?? "Current records"}
            </p>
          </div>
        </div>))}
    </div>);
}
export function TextField({ label, error, help, multiline, prefix, ...props }) {
    const fieldId = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
    const describedBy = error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined;
    return (<Field data-invalid={!!error}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {props.required && <span className="text-destructive">*</span>}
      </FieldLabel>
      {multiline ? (<Textarea {...props} id={fieldId} aria-invalid={!!error} aria-describedby={describedBy}/>) : prefix ? (<InputGroup>
          <InputGroupAddon>{prefix}</InputGroupAddon>
          <InputGroupInput {...props} id={fieldId} aria-invalid={!!error} aria-describedby={describedBy}/>
        </InputGroup>) : (<Input {...props} id={fieldId} aria-invalid={!!error} aria-describedby={describedBy}/>)}
      {help && (<FieldDescription id={`${fieldId}-help`}>{help}</FieldDescription>)}
      {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
    </Field>);
}
export function SelectField({ label, options, placeholder, error, ...props }) {
    const fieldId = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
    return (<Field data-invalid={!!error}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {props.required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <div className="relative w-full">
        <select {...props} id={fieldId} className={cn("form-select appearance-none pr-10", props.className)} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((item) => {
              const option = typeof item === "string" ? { label: item, value: item } : item;
              return (<option key={option.value} value={option.value}>
                {option.label}
              </option>);
          })}
        </select>
        {!props.disabled && <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      </div>
      {error && <FieldError id={`${fieldId}-error`}>{error}</FieldError>}
    </Field>);
}
export function CompanyMark({ initials, color = "blue", large = false, src }) {
    // Remember which URL failed instead of a boolean: a replaced logo arrives
    // as a new versioned src, so the mark retries it with no reset effect.
    const [failedSrc, setFailedSrc] = useState(null);
    const showImage = Boolean(src) && failedSrc !== src;
    return (<span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl font-bold tracking-tight", `company-${color}`, large && "size-16 rounded-2xl text-3xl")}>
      {showImage ? (<img src={src} alt="" className="size-full object-cover" loading="lazy" decoding="async" onError={() => setFailedSrc(src)}/>) : (initials)}
    </span>);
}
export function SuccessMark() {
    return (<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
      <CheckCircle2 className="size-8"/>
    </div>);
}
const HEADING_BASE = "font-semibold text-navy tracking-[-0.03em] transition-colors duration-300";
// Size is opt-in: a base text size would beat a caller's text-xs via the
// unpaired sm: variant, growing every small portal heading.
const HEADING_SIZES = { plain: "", display: "text-xl sm:text-2xl" };
const HEADING_SPLIT_LIMIT = 160;
// Two speeds: big text reads fast, small text gets a touch more time so the
// cascade stays legible (body = display + 25%).
const HEADING_TIMING = {
    display: { stagger: 15, cap: 360 },
    body: { stagger: 18.75, cap: 450 },
};
const HEADING_WORD_STYLE = { display: "inline-block", whiteSpace: "nowrap" };
function headingText(node) {
    // Flattened accessible name: numbers and strings concatenate, <br> reads as
    // a space, wrappers contribute their descendants.
    if (node === null || node === undefined || typeof node === "boolean")
        return "";
    if (typeof node === "string" || typeof node === "number")
        return String(node);
    if (Array.isArray(node))
        return node.map(headingText).join("");
    if (!isValidElement(node))
        return "";
    return node.type === "br" ? " " : headingText(node.props?.children);
}
function headingSplittable(node) {
    // Everything React can render is splittable: text and wrappers split,
    // opaque component output (icons) is carried through untouched.
    if (node === null || node === undefined || typeof node === "boolean")
        return true;
    if (typeof node === "string" || typeof node === "number")
        return true;
    if (Array.isArray(node))
        return node.every(headingSplittable);
    return isValidElement(node);
}
function renderHeadingText(text, cursor) {
    // Whitespace is kept verbatim (a heading may rely on an explicit space
    // between segments); words keep their own wrapper so they never break
    // mid-line. Letters carry the cascade index, global across segments.
    return text.split(/(\s+)/).filter(Boolean).map((part) => {
        if (!part.trim())
            return part;
        return (<span key={`w${cursor.key++}`} style={HEADING_WORD_STYLE}>
          {[...part].map((letter) => {
            const delay = `${Math.min(cursor.index++ * cursor.timing.stagger, cursor.timing.cap)}ms`;
            return (<span key={`l${cursor.key++}`} className="ltr" style={{ display: "inline-block", animationDelay: delay, "--ltr-delay": delay }}>
                {letter}
              </span>);
        })}
        </span>);
    });
}
function renderHeadingChildren(node, cursor) {
    if (node === null || node === undefined || typeof node === "boolean")
        return null;
    if (typeof node === "string" || typeof node === "number")
        return renderHeadingText(String(node), cursor);
    if (Array.isArray(node))
        return node.map((child) => renderHeadingChildren(child, cursor));
    if (!isValidElement(node))
        return null;
    const key = `n${cursor.key++}`;
    if (node.type === "br")
        return cloneElement(node, { key });
    // Host elements keep their props and classes; their children split in place.
    if (typeof node.type === "string")
        return cloneElement(node, { key }, renderHeadingChildren(node.props.children, cursor));
    return cloneElement(node, { key });
}
function Heading({ tag: Tag = "h3", rich = false, children, className, animated = true, size = "plain", base = HEADING_BASE, sizes = HEADING_SIZES, labeled = true, tier = "body", ...props }) {
    const ref = useRef(null);
    const [state, setState] = useState("hidden");
    const timing = HEADING_TIMING[tier] ?? HEADING_TIMING.body;
    const text = headingText(children).replace(/\s+/g, " ").trim();
    // Static path: anything we cannot or should not animate renders plain, so
    // the heading text is never trapped invisible. H3 keeps its string-only
    // split for its plain-text call sites; H1 also takes composed children
    // (landing hero) where wrappers and <br> must survive the split.
    const split = animated
        && (rich || typeof children === "string")
        && headingSplittable(children)
        && text.length > 0
        && text.length <= HEADING_SPLIT_LIMIT
        && typeof window !== "undefined"
        && typeof window.IntersectionObserver === "function";
    useEffect(() => {
        if (!split)
            return undefined;
        if (!ref.current) {
            // A caller-passed ref in {...props} overrides the internal one, so this
            // element can never be observed. Reveal off the effect tick instead of
            // leaving the heading invisible.
            queueMicrotask(() => setState("run"));
            return undefined;
        }
        let observer;
        let observing = false;
        try {
            // No inset margin: the reveal starts as soon as any part of the
            // element is visible in the viewport.
            observer = new window.IntersectionObserver(([entry], obs) => {
                if (!entry.isIntersecting)
                    return;
                obs.disconnect();
                // The browser fires this outside React, so flush now and start
                // the reveal on the observed frame. A synchronous observe() ack
                // arrives inside the effect, where plain state is already batched.
                if (observing)
                    setState("run");
                else
                    flushSync(() => setState("run"));
            }, { rootMargin: "0px" });
            observing = true;
            observer.observe(ref.current);
        }
        catch {
            // Broken observer: reveal off the effect tick so the text can never
            // stay hidden (lint forbids the cascading sync update here).
            queueMicrotask(() => setState("run"));
        }
        finally {
            observing = false;
        }
        return () => observer?.disconnect();
    }, [split]);
    const classes = cn(base, sizes?.[size], className);
    if (!split) {
        return (<Tag className={classes} {...props}>
        {children}
      </Tag>);
    }
    return (<Tag ref={ref} aria-label={labeled ? text : undefined} data-letter-reveal data-state={state} data-tier={tier} className={classes} {...props}>
      <span aria-hidden={labeled ? "true" : undefined}>{renderHeadingChildren(children, { index: 0, key: 0, timing })}</span>
    </Tag>);
}
export function H3({ tier = "body", ...props }) {
    return <Heading {...props} tier={tier}/>;
}
export function H1({ tier = "display", ...props }) {
    return <Heading {...props} tier={tier} tag="h1" rich/>;
}
export function RevealText({ as: Tag = "span", children, className, animated = true, tier = "body", ...props }) {
    // Landing-copy variant: no typography defaults and no aria overrides, so
    // the letters stay the element's real text content and parents (links,
    // accordion buttons) keep their accessible names.
    return (<Heading tag={Tag} rich labeled={false} base="" sizes={null} className={className} animated={animated} tier={tier} {...props}>
      {children}
    </Heading>);
}
export function CountUp({ value, duration = 600, className, ...props }) {
    // Stat numbers count 0 → value instead of revealing by letter (ADR-051
    // amendment): the same one-shot in-view trigger, but the number itself
    // animates. It runs under prefers-reduced-motion too — a changing value is
    // not vestibular motion — so only a missing IntersectionObserver
    // (jsdom/legacy) gets the final value at once. The 30 s refresh updates
    // the number without re-counting.
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
    const [canAnimate] = useState(() => typeof window !== "undefined"
        && typeof window.IntersectionObserver === "function");
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    const [count, setCount] = useState(0);
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (!canAnimate || !ref.current)
            return undefined;
        const observer = new window.IntersectionObserver(([entry], obs) => {
            if (!entry.isIntersecting)
                return;
            obs.disconnect();
            setInView(true);
        }, { rootMargin: "0px" });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [canAnimate]);
    // Starts once in view with a real number to count to; a value that arrives
    // after the trigger (the stats API) starts the count from where it is.
    const active = canAnimate && inView && numeric !== null && !done;
    useEffect(() => {
        if (!active)
            return undefined;
        let frame = 0;
        let start = null;
        const step = (now) => {
            if (start === null)
                start = now;
            const progress = duration > 0 ? Math.min((now - start) / duration, 1) : 1;
            if (progress < 1) {
                setCount(Math.round(numeric * (1 - Math.pow(1 - progress, 3))));
                frame = window.requestAnimationFrame(step);
                return;
            }
            setCount(numeric);
            setDone(true);
        };
        frame = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(frame);
    }, [active, numeric, duration]);
    const text = numeric === null
        ? "—"
        : (!canAnimate || done ? numeric : inView ? count : 0).toLocaleString();
    return (<p ref={ref} className={className} {...props}>
      {text}
    </p>);
}
