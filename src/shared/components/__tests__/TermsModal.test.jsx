import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TermsModal from '../TermsModal'
import { getLegal } from '../../services/legal'

vi.mock('../../services/legal', () => ({ getLegal: vi.fn() }))

function renderModal(props = {}) {
  return render(<TermsModal open onClose={vi.fn()} title="Terms & Privacy" body="Some policy body text" {...props} />)
}

describe('TermsModal acceptance gate', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<TermsModal open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the terms dialog with title, body and a Close button when open', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Terms & Privacy')).toBeInTheDocument()
    expect(screen.getByText('Some policy body text')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    // The overlay is the dialog's parent inside the portal.
    fireEvent.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marks non-scrollable content as read and locks body scroll', () => {
    const onRead = vi.fn()
    renderModal({ onRead })
    // jsdom has no layout, so the content can't scroll → auto counts as read.
    expect(onRead).toHaveBeenCalled()
    expect(document.body.style.overflow).toBe('hidden')
  })
})

describe('TermsModal published privacy notice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the API body when available', async () => {
    getLegal.mockResolvedValue('API body')
    render(<TermsModal open onClose={vi.fn()} title="Terms & Privacy" />)
    expect(await screen.findByText('API body')).toBeInTheDocument()
  })

  it('renders the bundled fallback when getLegal rejects', async () => {
    getLegal.mockRejectedValue(new Error('boom'))
    render(<TermsModal open onClose={vi.fn()} title="Terms & Privacy" />)
    await waitFor(() =>
      expect(screen.getByText(/Data Privacy Act of 2012, RA 10173/)).toBeInTheDocument(),
    )
  })
})
