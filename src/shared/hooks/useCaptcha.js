import { useCallback, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';

// Token state for one captcha-gated submit. Turnstile tokens are single-use, so
// every failure calls reset(): it clears the token and bumps `round`, which
// makes the widget run a fresh challenge before the next attempt.
export default function useCaptcha() {
  const [token, setToken] = useState('');
  const [round, setRound] = useState(0);
  // The widget itself failed (blocked script, Cloudflare error). Submit must
  // then fall through to Supabase instead of locking the form forever.
  const [unavailable, setUnavailable] = useState(false);

  const reset = useCallback(() => {
    setToken('');
    setRound((value) => value + 1);
    setUnavailable(false);
  }, []);

  const fail = useCallback(() => {
    setToken('');
    setUnavailable(true);
  }, []);

  return { token, setToken, round, reset, fail, unavailable, required: Boolean(TURNSTILE_SITE_KEY) };
}
