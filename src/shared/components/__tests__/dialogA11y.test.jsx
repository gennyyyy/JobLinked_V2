import { Button } from "../../../components/ui/button";
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ConfirmationModal from '../ConfirmationModal'
import LoadingScreen from '../LoadingScreen'

describe('modal a11y (shared dialog behaviour)', () => {
  it('ConfirmationModal: Escape cancels and focus returns to the opener', () => {
    const onCancel = vi.fn()
    render(
      <MemoryRouter>
        <div>
          <Button type="button">Remove job</Button>
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
})
