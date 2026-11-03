import { Bell, BellRing, ShieldCheck, ShieldAlert, Briefcase, FileText } from "lucide-react";

// Icon + colour for a notification's type. Shared by the bell dropdown and the
// notification history page so the same notification reads the same in both.
// The tile owns the colour; the lucide icon inherits it via currentColor.

function isSystem(n) {
  return n.type === "system";
}

export function getNotificationVisual(n) {
  const type = (n.type || "").toLowerCase();
  const title = (n.title || "").toLowerCase();
  const message = (n.message || "").toLowerCase();

  if (title.includes("approved") || message.includes("approved")) {
    return {
      icon: ShieldCheck,
      tone: "success",
      colorClass: "bg-emerald-100 border-emerald-200 text-emerald-700",
      badgeText: "Approved",
    };
  }
  if (
    title.includes("revoked") ||
    title.includes("rejected") ||
    message.includes("revoked") ||
    message.includes("rejected")
  ) {
    return {
      icon: ShieldAlert,
      tone: "danger",
      colorClass: "bg-rose-100 border-rose-200 text-rose-700",
      badgeText: title.includes("revoked") ? "Revoked" : "Rejected",
    };
  }
  if (type === "accreditation" || title.includes("accreditation")) {
    return {
      icon: ShieldCheck,
      tone: "warning",
      colorClass: "bg-amber-100 border-amber-200 text-amber-700",
      badgeText: "Accreditation",
    };
  }
  if (type === "job" || title.includes("job")) {
    return {
      icon: Briefcase,
      tone: "info",
      colorClass: "bg-blue-100 border-blue-200 text-blue-700",
      badgeText: "Job Posting",
    };
  }
  if (type === "application" || title.includes("applicant") || title.includes("application")) {
    return {
      icon: FileText,
      tone: "purple",
      colorClass: "bg-indigo-100 border-indigo-200 text-indigo-700",
      badgeText: "Application",
    };
  }
  if (type === "system" || isSystem(n)) {
    return {
      icon: BellRing,
      tone: "info",
      colorClass: "bg-primary/10 border-primary/20 text-primary",
      badgeText: "System",
    };
  }

  return {
    icon: Bell,
    tone: "neutral",
    colorClass: "bg-gray-100 border-gray-200 text-gray-600",
    badgeText: "",
  };
}
