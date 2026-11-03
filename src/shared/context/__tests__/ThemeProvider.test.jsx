import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from '../ThemeProvider'

function Probe() {
  const { theme, resolved, setTheme } = useTheme()
  return <div><span data-testid="theme">{theme}</span><span data-testid="resolved">{resolved}</span><button onClick={() => setTheme('dark')}>dark</button><button onClick={() => setTheme('light')}>light</button></div>
}

describe('ThemeProvider', () => {
  let changeHandler
  let matches

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
    matches = false
    changeHandler = null
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return matches },
      addEventListener: (_, handler) => { changeHandler = handler },
      removeEventListener: vi.fn(),
    })))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('defaults to the system preference', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('applies a dark system preference and responds to changes', () => {
    matches = true
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement).toHaveClass('dark')
    matches = false
    act(() => changeHandler({ matches }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('persists and applies an explicit choice', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    act(() => screen.getByText('dark').click())
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('falls back to system for an invalid stored value', () => {
    localStorage.setItem('theme', 'invalid')
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })

  it('ignores system changes after an explicit selection', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    act(() => screen.getByText('dark').click())
    matches = false
    act(() => changeHandler({ matches }))
    expect(document.documentElement).toHaveClass('dark')
  })

  it('works when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => render(<ThemeProvider><Probe /></ThemeProvider>)).not.toThrow()
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })
})
