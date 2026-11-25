import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

const VARIANTS = {
  success: { role: "status", tone: "border-success/20 bg-success-soft text-success", Icon: CheckCircle2 },
  error: { role: "alert", tone: "border-danger/20 bg-danger-soft text-destructive", Icon: AlertTriangle },
  warning: { role: "alert", tone: "border-warning/20 bg-warning-soft text-warning", Icon: AlertTriangle },
  info: { role: "status", tone: "border-primary/10 bg-blue-soft text-navy", Icon: Info },
}

// One inline action banner. Toast is the floating counterpart.
export default function Flash({ variant = "success", children, className, onDismiss }) {
  const { role, tone, Icon } = VARIANTS[variant] ?? VARIANTS.success

  return (
    <div role={role} className={cn("flex items-start gap-2.5 rounded-control border px-4 py-3 text-xs font-medium", tone, className)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="ml-auto shrink-0 rounded-md p-1 opacity-70 hover:opacity-100">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
