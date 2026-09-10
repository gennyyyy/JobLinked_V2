import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from './useAuth';

const AFK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const WARNING_TIME = 4 * 60 * 1000; // 4 minutes

function useAFKTimer(enabled = true) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const onWarningRef = useRef(null);

  const resetTimer = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    if (!enabled || !user) return;

    // Set warning timeout at 4 minutes
    warningTimeoutRef.current = setTimeout(() => {
      if (onWarningRef.current) {
        onWarningRef.current();
      }
    }, WARNING_TIME);

    // Set logout timeout at 5 minutes
    timeoutRef.current = setTimeout(() => {
      logout();
      navigate('/');
    }, AFK_TIMEOUT);
  }, [enabled, user, logout, navigate]);

  useEffect(() => {
    if (!enabled || !user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Initialize timer on mount
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [enabled, user, resetTimer]);

  return {
    setWarningCallback: (callback) => {
      onWarningRef.current = callback;
    },
  };
}

export default useAFKTimer;
