import { useCallback, useEffect, useState } from 'react';

// Button-side mirror of the server's 60s email throttle. `start()` begins (or
// restarts) the count; the owner disables its action while `cooling`.
export default function useCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const cooling = remaining > 0;

  useEffect(() => {
    if (!cooling) return undefined;
    const id = setInterval(() => setRemaining((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooling]);

  const start = useCallback((length = seconds) => setRemaining(length), [seconds]);

  return { seconds: remaining, cooling, start };
}
