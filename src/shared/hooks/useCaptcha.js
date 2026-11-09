import { useCallback, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';

// Token state for one captcha-gated submit. Turnstile tokens are single-use, so
// every failure calls reset(): it clears the token and bumps `round`, which
// makes the widget run a fresh challenge before the next attempt.
export default function useCaptcha() {
  const [token, setToken] = useState('');
  const [round, setRound] = useState(0);

  const reset = useCallback(() => {
    setToken('');
    setRound((value) => value + 1);
  }, []);

  return { token, setToken, round, reset, required: Boolean(TURNSTILE_SITE_KEY) };
}
