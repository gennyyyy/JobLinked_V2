import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Toast from '../Toast'

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<Toast message="" onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the message in a polite status region', () => {
    render(<Toast message="Saved successfully" onClose={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Saved successfully')).toBeInTheDocument()
  })

  it('renders the error variant as an alert region', () => {
    render(<Toast message="Something failed" variant="error" onClose={vi.fn()} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('Something failed')
  })

  it('renders no dismiss button inside the status region', () => {
    render(<Toast message="Heads up" onClose={vi.fn()} />)
    expect(screen.getByRole('status').querySelector('button')).toBeNull()
  })

  it('auto-dismisses after the duration', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Toast message="Heads up" onClose={onClose} duration={4000} />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
