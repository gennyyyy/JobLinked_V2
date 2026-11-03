import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

  it('renders the error variant as a status region too', () => {
    render(<Toast message="Something failed" variant="error" onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Something failed')).toBeInTheDocument()
  })

  it('calls onClose when the dismiss button is clicked', () => {
    const onClose = vi.fn()
    render(<Toast message="Heads up" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
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
