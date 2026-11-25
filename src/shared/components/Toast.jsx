import { useEffect } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function Toast({ message, variant = "success", onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const isError = variant === "error";
  const Icon = isError ? AlertTriangle : CheckCircle2;

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`fixed top-4 left-1/2 z-[9999] -translate-x-1/2 max-w-[calc(100%-2rem)] px-4 py-2.5 rounded-control border text-sm flex items-center gap-3 shadow-lg ${
        isError
          ? "bg-danger-soft border-danger/20 text-destructive"
          : "bg-success-soft border-success/20 text-success"
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${isError ? "text-destructive" : "text-success"}`} />
      <span>{message}</span>
    </div>
  );
}
