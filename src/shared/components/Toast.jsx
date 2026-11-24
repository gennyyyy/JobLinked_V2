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
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 z-[9999] -translate-x-1/2 max-w-[calc(100%-2rem)] px-4 py-2.5 rounded-xl border text-sm flex items-center gap-3 shadow-xs ${
        isError
          ? "bg-rose-50 border-rose-200 text-rose-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${isError ? "text-rose-600" : "text-emerald-600"}`} />
      <span>{message}</span>
    </div>
  );
}
