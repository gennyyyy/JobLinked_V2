import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useDialog from '../useDialog'

function Harness({ onClose = vi.fn(), open = true, children = 'Panel body' }) {
  const panelRef = useDialog(onClose, open)
  return (
    <div>
      <button type="button">Opener</button>
      <div ref={panelRef} role="dialog" aria-modal="true">
        <button type="button">First</button>
        {children}
        <button type="button">Last</button>
      </div>
    </div>
  )
}

describe('useDialog', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing while closed', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} open={false} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus into the panel and wraps Tab on the last control', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Last' }), { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('returns focus to the opener and restores scrolling when it closes', () => {
    const { rerender } = render(<Harness open={false} />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    expect(opener).toHaveFocus()

    // Dialog mounts with the opener focused, the way a real activation leaves it.
    rerender(<Harness open />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Harness open={false} />)
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(opener).toHaveFocus()
  })
})
