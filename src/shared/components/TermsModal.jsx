import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useDialog from "../hooks/useDialog";
import { PRIVACY_NOTICE } from "../content/legal";
import { getLegal } from "../services/legal";

// The registration consent is the privacy notice (G2): one source of
// truth with /privacy, fetched from the published document with a bundled
// fallback so the modal never breaks if the API is down.
const TERMS_PLACEHOLDER = PRIVACY_NOTICE;

function TermsModal({ open, onClose, onRead, title = "Data Collection Terms & Privacy Policy", body: bodyProp }) {
  const bodyRef = useRef(null);
  const readRef = useRef(false);
  const [read, setRead] = useState(false);
  const [fetched, setFetched] = useState(null);

  const markRead = useCallback(() => {
    if (readRef.current) return;
    readRef.current = true;
    setRead(true);
    onRead?.();
  }, [onRead]);

  // Read = scrolled to the bottom (24px grace). Short content that
  // doesn't scroll counts as read as soon as it's shown.
  function handleScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) markRead();
  }

  const panelRef = useDialog(onClose, open);

  // Fetch the published privacy notice when no explicit body is supplied.
  useEffect(() => {
    if (!open || bodyProp != null) return;
    let active = true;
    getLegal("privacy")
      .then((text) => {
        if (!active) return;
        setFetched(text && String(text).trim() ? text : TERMS_PLACEHOLDER);
      })
      .catch(() => {
        if (!active) return;
        setFetched(TERMS_PLACEHOLDER);
      });
    return () => {
      active = false;
    };
  }, [open, bodyProp]);

  const body = bodyProp != null ? bodyProp : fetched;
  const showSkeleton = bodyProp == null && open && body == null;

  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (el && el.scrollHeight - el.clientHeight < 24) markRead();
  }, [open, body, markRead]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="bg-card border border-primary rounded-lg p-5 max-w-lg w-[calc(100%-2rem)] max-h-[80vh] flex flex-col shadow-2xl"
      >
        <h2 id="terms-title" className="text-base font-bold text-dark-blue mb-3">
          {title}
        </h2>
        <div ref={bodyRef} onScroll={handleScroll} tabIndex={0} role="document" aria-labelledby="terms-title" className="text-sm text-muted-foreground whitespace-pre-line overflow-y-auto flex-1 mb-6">
          {showSkeleton ? <Skeleton className="h-4 w-full" /> : body}
        </div>
        <div className="flex gap-3 items-center justify-end">
          {onRead && !read && (
            <span className="mr-auto text-xs text-muted-foreground">Scroll to the bottom to enable agreement.</span>
          )}
          <Button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-primary hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TermsModal;