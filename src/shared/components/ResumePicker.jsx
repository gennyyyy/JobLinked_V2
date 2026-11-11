import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ResumePicker({
  id,
  label,
  accept,
  help,
  status,
  error,
  disabled = false,
  onChange,
  className,
  labelClassName,
  children,
  statusProps,
  reviewAcknowledgement,
}) {
  return (
    <section className={cn("rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4", className)}>
      <Label htmlFor={id} className={cn("text-primary", labelClassName)}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className="mt-2 flex min-h-[40px] w-full items-center rounded-none border-0 bg-transparent px-0 py-0 text-xs text-muted-foreground shadow-none outline-none ring-0 focus-visible:border-0 focus-visible:ring-0 file:mr-3 file:inline-flex file:min-h-[40px] file:items-center file:justify-center file:rounded-xl file:border-0 file:bg-primary file:px-4 file:text-xs file:font-semibold file:text-white file:focus-visible:ring-2 file:focus-visible:ring-primary hover:file:bg-primary-hover file:cursor-pointer cursor-pointer"
      />
      {help && <p className="mt-2 text-xs text-muted-foreground">{help}</p>}
      {reviewAcknowledgement && (
        <div data-invalid={!!reviewAcknowledgement.error} className="mt-2">
          <label htmlFor={reviewAcknowledgement.id || `${id}-review-confirmed`} className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              id={reviewAcknowledgement.id || `${id}-review-confirmed`}
              type="checkbox"
              checked={reviewAcknowledgement.checked}
              required={reviewAcknowledgement.required}
              onChange={(event) => reviewAcknowledgement.onChange(event.target.checked)}
              aria-invalid={reviewAcknowledgement.error ? "true" : undefined}
              aria-describedby={reviewAcknowledgement.error ? `${reviewAcknowledgement.id || `${id}-review-confirmed`}-error` : undefined}
              className="mt-0.5 shrink-0"
            />
            <span>
              {reviewAcknowledgement.label}
              {reviewAcknowledgement.required && <span className="text-danger" aria-hidden="true"> *</span>}
            </span>
          </label>
          {reviewAcknowledgement.error && (
            <p id={`${reviewAcknowledgement.id || `${id}-review-confirmed`}-error`} className="mt-1 text-xs text-danger">
              {reviewAcknowledgement.error}
            </p>
          )}
        </div>
      )}
      {children && <div className="mt-2">{children}</div>}
      {status && (
        <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-primary" {...statusProps}>
          {status}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </section>
  );
}