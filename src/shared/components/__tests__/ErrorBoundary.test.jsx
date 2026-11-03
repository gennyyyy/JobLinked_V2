import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

function Boom() {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  it('renders children while nothing throws', () => {
    render(<ErrorBoundary><p>Board</p></ErrorBoundary>)
    expect(screen.getByText('Board')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })

  it('catches a render throw, logs it, and offers a Reload button', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByText('Board')).not.toBeInTheDocument()
    expect(logged).toHaveBeenCalled()

    logged.mockRestore()
  })

  it('reloads the page when Reload is clicked', () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { value: { ...original, reload }, writable: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    screen.getByRole('button', { name: 'Reload' }).click()
    expect(reload).toHaveBeenCalled()

    Object.defineProperty(window, 'location', { value: original, writable: true })
    vi.restoreAllMocks()
  })
})
