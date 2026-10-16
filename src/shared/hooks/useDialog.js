import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

// One dialog implementation for every modal (TermsModal's behavior, extracted):
// Escape closes, Tab cycles inside the panel, focus returns to whatever opened
// it, and body scroll is locked while it is open.
//
//   const panelRef = useDialog(onClose, open)
// Attach panelRef to the element carrying role="dialog".
export default function useDialog(onClose, open = true) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    const panel = panelRef.current;
    const items = () => (panel ? Array.from(panel.querySelectorAll(FOCUSABLE)) : []);
    items()[0]?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (active && panel?.contains(active)) {
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      // Focus escaped the panel (e.g. an address bar round-trip): pull it back.
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener && opener.focus) opener.focus();
    };
  }, [open]);

  return panelRef;
}
