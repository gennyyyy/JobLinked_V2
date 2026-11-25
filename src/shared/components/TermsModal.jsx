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

// Fractional scroll offsets mean "bottom" is never exactly max - scrollTop.
const atBottom = (el) => el.scrollHeight - el.clientHeight - el.scrollTop <= 1;

function TermsModal({ open, onClose, onRead, onAccept, title = "Data Collection Terms & Privacy Policy", body: bodyProp }) {
  const bodyRef = useRef(null);
  const readRef = useRef(false);
  const [read, setRead] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fetched, setFetched] = useState(null);

  const markRead = useCallback(() => {
    if (readRef.current) return;
    readRef.current = true;
    setRead(true);
    onRead?.();
  }, [onRead]);

  // Escape and backdrop clicks stay inert until the notice is read.
  const closeIfRead = useCallback(() => {
    if (readRef.current) onClose?.();
  }, [onClose]);

  // Read = scrolled to the true bottom. Short content that doesn't
  // scroll counts as read as soon as it's shown.
  function handleScroll(e) {
    const el = e.currentTarget;
    if (atBottom(el)) {
      setProgress(100);
      markRead();
      return;
    }
    setProgress(Math.min(99, (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100));
  }

  const panelRef = useDialog(closeIfRead, open);

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
    // Never measure the loading skeleton: it cannot scroll, so it would
    // auto-mark the notice as read before the text arrives. Progress stays
    // at its initial 0 until there is content to measure.
    if (body == null) return;
    const el = bodyRef.current;
    if (!el) return;
    // Already read in this session, or content short enough not to scroll:
    // the bar starts full and the Close button is available at once.
    if (readRef.current || atBottom(el)) {
      setProgress(100);
      markRead();
    }
  }, [open, body, markRead]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeIfRead();
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
        <div ref={bodyRef} onScroll={handleScroll} tabIndex={0} role="document" aria-labelledby="terms-title" className="text-sm text-muted-foreground whitespace-pre-line overflow-y-auto flex-1 min-h-0 mb-4">
          {showSkeleton ? <Skeleton className="h-4 w-full" /> : body}
        </div>
        <div
          className="mb-4 h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex h-11 shrink-0 gap-3 items-center justify-end">
          {onRead && !read && (
            <span className="mr-auto truncate text-xs text-muted-foreground">Scroll to the bottom to enable agreement.</span>
          )}
          {read && (
            <Button
              type="button"
              onClick={() => {
                onAccept?.();
                onClose?.();
              }}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-primary hover:bg-primary-hover transition-colors cursor-pointer"
            >
              Close &amp; Accept
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TermsModal;