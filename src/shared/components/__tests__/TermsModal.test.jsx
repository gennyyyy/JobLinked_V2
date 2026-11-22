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

  it('hides Close until the reader reaches the bottom of a scrollable body', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
    try {
      renderModal()
      const body = screen.getByRole('document')
      const bar = screen.getByRole('progressbar')
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
      expect(bar).toHaveAttribute('aria-valuenow', '0')

      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 700 })
      fireEvent.scroll(body)

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      expect(bar).toHaveAttribute('aria-valuenow', '100')
    } finally {
      delete HTMLElement.prototype.scrollHeight
      delete HTMLElement.prototype.clientHeight
    }
  })

  it('reads only at the true bottom: 10px short stays gated, 1px short reads', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
    try {
      const onRead = vi.fn()
      renderModal({ onRead })
      const body = screen.getByRole('document')
      const bar = screen.getByRole('progressbar')

      // 10px short of the 700px max: no Close, no onRead, progress capped at 99.
      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 690 })
      fireEvent.scroll(body)
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
      expect(onRead).not.toHaveBeenCalled()
      expect(bar).toHaveAttribute('aria-valuenow', '99')

      // 1px short is the fractional-scroll tolerance: reads.
      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 699 })
      fireEvent.scroll(body)
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      expect(bar).toHaveAttribute('aria-valuenow', '100')
      expect(onRead).toHaveBeenCalledTimes(1)
    } finally {
      delete HTMLElement.prototype.scrollHeight
      delete HTMLElement.prototype.clientHeight
    }
  })

  it('reserves the footer height and clips the hint so the read swap cannot reflow', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
    try {
      renderModal({ onRead: vi.fn() })
      expect(screen.getByText(/scroll to the bottom/i)).toHaveClass('truncate')

      const body = screen.getByRole('document')
      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 700 })
      fireEvent.scroll(body)

      const footer = screen.getByRole('progressbar').nextElementSibling
      expect(screen.getByRole('progressbar')).toHaveClass('shrink-0')
      expect(footer).toHaveClass('h-11', 'shrink-0')
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    } finally {
      delete HTMLElement.prototype.scrollHeight
      delete HTMLElement.prototype.clientHeight
    }
  })

  it('keeps partial progress when a parent re-render changes the onRead identity', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
    try {
      const onRead = vi.fn()
      const { rerender } = renderModal({ onRead })
      const body = screen.getByRole('document')

      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 350 })
      fireEvent.scroll(body)
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull()

      const nextOnRead = vi.fn()
      rerender(<TermsModal open onClose={vi.fn()} title="Terms & Privacy" body="Some policy body text" onRead={nextOnRead} />)
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull()

      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 700 })
      fireEvent.scroll(body)
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      expect(onRead).not.toHaveBeenCalled()
      expect(nextOnRead).toHaveBeenCalledTimes(1)
    } finally {
      delete HTMLElement.prototype.scrollHeight
      delete HTMLElement.prototype.clientHeight
    }
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

  it('stays inert while loading, then gates dismissal on reading to the bottom', async () => {
    let resolveLegal
    getLegal.mockReturnValue(new Promise((resolve) => { resolveLegal = resolve }))
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
    try {
      const onClose = vi.fn()
      const onRead = vi.fn()
      render(<TermsModal open onClose={onClose} onRead={onRead} title="Terms & Privacy" />)

      // Loading: skeleton only — no Close, 0%, Escape and backdrop inert.
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
      fireEvent.keyDown(document, { key: 'Escape' })
      fireEvent.click(screen.getByRole('dialog').parentElement)
      expect(onClose).not.toHaveBeenCalled()
      expect(onRead).not.toHaveBeenCalled()

      resolveLegal('Long notice text')
      expect(await screen.findByText('Long notice text')).toBeInTheDocument()

      // Scrollable body at the top: still gated.
      const body = screen.getByRole('document')
      expect(body.className).toContain('min-h-0')
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
      expect(onRead).not.toHaveBeenCalled()

      Object.defineProperty(body, 'scrollTop', { configurable: true, value: 700 })
      fireEvent.scroll(body)

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
      expect(onRead).toHaveBeenCalledTimes(1)
    } finally {
      delete HTMLElement.prototype.scrollHeight
      delete HTMLElement.prototype.clientHeight
    }
  })
})
