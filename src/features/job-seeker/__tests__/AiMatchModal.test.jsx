import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AiMatchModal from '../AiMatchModal'

describe('AiMatchModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AiMatchModal open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByPlaceholderText(/type a message/i)).toBeNull()
  })

  it('renders the empty prompt and a send form when open', () => {
    render(<AiMatchModal open onClose={vi.fn()} />)
    expect(screen.getByText('Ask about jobs that fit you.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('appends a user message and the placeholder AI reply, then clears the input', async () => {
    const user = userEvent.setup()
    render(<AiMatchModal open onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'warehouse jobs')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText('warehouse jobs')).toBeInTheDocument()
    expect(screen.getByText(/not connected yet/i)).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('ignores an empty submit', async () => {
    const user = userEvent.setup()
    render(<AiMatchModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /send/i }))

    // No messages rendered; empty prompt is still shown.
    expect(screen.getByText('Ask about jobs that fit you.')).toBeInTheDocument()
    expect(screen.queryByText(/not connected yet/i)).toBeNull()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AiMatchModal open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
