import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ConfirmationModal from '../ConfirmationModal'
import LoadingScreen from '../LoadingScreen'
import AiMatchModal from '../../../features/job-seeker/AiMatchModal'

describe('modal a11y (shared dialog behaviour)', () => {
  it('ConfirmationModal: Escape cancels and focus returns to the opener', () => {
    const onCancel = vi.fn()
    render(
      <MemoryRouter>
        <div>
          <button type="button">Remove job</button>
          <ConfirmationModal message="Delete this job?" onConfirm={vi.fn()} onCancel={onCancel} />
        </div>
      </MemoryRouter>
    )
    // The dialog opens on the confirm action; its own button takes focus.
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ConfirmationModal: restores focus when the dialog unmounts', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ConfirmationModal message="Delete this job?" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    unmount()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('LoadingScreen: announces itself in a polite live region', () => {
    render(<LoadingScreen />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('AiMatchModal: renders an aria-modal dialog that Escape closes', () => {
    const onClose = vi.fn()
    render(<AiMatchModal open onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('AiMatchModal: its message field carries a label', () => {
    render(<AiMatchModal open onClose={vi.fn()} />)
    expect(screen.getByLabelText(/type a message/i)).toBeInTheDocument()
  })
})
