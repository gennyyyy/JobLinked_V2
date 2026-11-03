import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

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
      className={`fixed top-4 right-4 z-[9999] p-4 rounded-xl border text-sm flex items-center justify-between gap-3 shadow-xs ${
        isError
          ? "bg-rose-50 border-rose-200 text-rose-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 shrink-0 ${isError ? "text-rose-600" : "text-emerald-600"}`} />
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className={`p-1 cursor-pointer ${isError ? "text-rose-600 hover:text-rose-800" : "text-emerald-600 hover:text-emerald-800"}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
