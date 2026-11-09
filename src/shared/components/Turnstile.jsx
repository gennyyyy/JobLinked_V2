import { useEffect, useRef, useState } from 'react';
import {
  TURNSTILE_SITE_KEY,
  loadTurnstile,
  renderTurnstile,
  resetTurnstile,
  removeTurnstile,
} from '../lib/turnstile';

// The visible bot check. Without a site key nothing renders and no script is
// loaded. A blocked script explains itself but never blocks submit: Supabase's
// verdict is the authority.
export default function Turnstile({ onToken, resetKey = 0 }) {
  const required = Boolean(TURNSTILE_SITE_KEY);
  const container = useRef(null);
  const widget = useRef(null);
  const handler = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    handler.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!required) return undefined;
    let live = true;

    loadTurnstile()
      .then(() => {
        if (!live || !container.current) return;
        widget.current = renderTurnstile(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          onToken: (token) => handler.current?.(token),
          onExpire: () => handler.current?.(''),
          onError: () => handler.current?.(''),
        });
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
      if (widget.current != null) removeTurnstile(widget.current);
      widget.current = null;
    };
  }, [required]);

  useEffect(() => {
    if (resetKey > 0 && widget.current != null) resetTurnstile(widget.current);
  }, [resetKey]);

  if (!required) return null;
  if (failed) {
    return (
      <p className="text-xs leading-6 text-muted-foreground">
        Verification could not load. You can still submit and we will check your request.
      </p>
    );
  }
  return <div ref={container} className="min-h-[65px]" />;
}
