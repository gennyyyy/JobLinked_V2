import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'theme'
const VALID_THEMES = new Set(['light', 'dark', 'system'])
const ThemeContext = createContext(null)

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return VALID_THEMES.has(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function prefersDark() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme)
  const [systemDark, setSystemDark] = useState(prefersDark)
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback((value) => {
    const next = VALID_THEMES.has(value) ? value : 'system'
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => setSystemDark(event.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [theme])

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// The context hook lives beside its provider so consumers share one context.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

// Exported for consumers that render outside the provider and must degrade
// gracefully instead of throwing (ThemeToggle in isolated test renders).
export { ThemeContext }
