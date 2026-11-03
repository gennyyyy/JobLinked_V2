import { useContext } from 'react'
import { Moon, Sun } from 'lucide-react'
import { ThemeContext } from '../context/ThemeProvider'

// Outside a ThemeProvider (isolated shells/tests) the system preference is
// shown and the toggle degrades to a no-op instead of crashing the render.
function useThemeState() {
  const context = useContext(ThemeContext)
  if (context) return context
  const dark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return { resolved: dark ? 'dark' : 'light', setTheme: () => {} }
}

export default function ThemeToggle() {
  const { resolved, setTheme } = useThemeState()
  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary   dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}
