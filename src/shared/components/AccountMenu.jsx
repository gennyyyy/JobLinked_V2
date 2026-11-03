import { useEffect, useRef, useState, useId } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { displayName, initialsOf } from "../utils/accountName";

export default function AccountMenu({ user, profileTo, roleLabel, onLogout }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const name = displayName(user, roleLabel);
  const initials = initialsOf(user, roleLabel);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={name}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted  transition-colors cursor-pointer"
      >
        <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
          {initials || "U"}
        </span>
        Account
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border  bg-card shadow-lg py-2 z-20"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
            {roleLabel && (
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{roleLabel}</p>
            )}
          </div>
          <Link
            to={profileTo}
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
            className="block w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-danger transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
