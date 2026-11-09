// Cloudflare Turnstile without an npm package: the script is injected once and
// shared for the life of the page. Every helper no-ops when no site key is
// configured, so dev, CI, and the preview harness render exactly as before.
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

let pending = null;

export function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Turnstile is unavailable.'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src*="turnstile"]');
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile failed to load.'));
    });
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load.')));
  });
  // A blocked script must not poison every later attempt.
  pending.catch(() => { pending = null; });
  return pending;
}

export function renderTurnstile(container, { sitekey = TURNSTILE_SITE_KEY, onToken, onExpire, onError }) {
  if (typeof window === 'undefined' || !window.turnstile || !container) return null;
  return window.turnstile.render(container, {
    sitekey,
    theme: 'light',
    callback: onToken,
    'expired-callback': onExpire,
    'error-callback': onError,
  });
}

export function resetTurnstile(widgetId) {
  if (typeof window !== 'undefined' && window.turnstile && widgetId != null) window.turnstile.reset(widgetId);
}

export function removeTurnstile(widgetId) {
  if (typeof window !== 'undefined' && window.turnstile && widgetId != null) window.turnstile.remove(widgetId);
}
