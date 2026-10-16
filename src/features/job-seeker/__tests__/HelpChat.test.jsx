import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HelpChat from '../HelpChat'
import { askHelp } from '../../../shared/services/ai'

vi.mock('../../../shared/services/ai', () => ({ askHelp: vi.fn() }))

const INPUT = /message the help assistant/i

async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Open help chat' }))
  return screen.getByRole('dialog')
}

async function ask(text) {
  fireEvent.change(screen.getByLabelText(INPUT), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(askHelp).toHaveBeenCalled())
}

describe('HelpChat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Help button with the panel closed until clicked', async () => {
    render(<HelpChat />)
    expect(screen.getByRole('button', { name: 'Open help chat' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()

    await open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('sends a question and renders the reply', async () => {
    askHelp.mockResolvedValue({ reply: 'Apply from the Browse Jobs page.' })
    render(<HelpChat />)
    await open()
    await ask('How do I apply?')

    expect(askHelp).toHaveBeenCalledTimes(1)
    expect(askHelp).toHaveBeenCalledWith([{ role: 'user', content: 'How do I apply?' }])
    expect(await screen.findByText('Apply from the Browse Jobs page.')).toBeInTheDocument()
  })

  it('sends only the last 10 messages of a longer transcript', async () => {
    askHelp.mockResolvedValue({ reply: 'ok' })
    render(<HelpChat />)
    await open()

    for (let i = 1; i <= 6; i += 1) {
      await ask(`q${i}`)
      await waitFor(() => expect(screen.getAllByText('ok').length).toBe(i))
    }
    askHelp.mockClear()
    await ask('q7')

    const sent = askHelp.mock.calls[0][0]
    expect(sent).toHaveLength(10)
    expect(sent.filter((m) => m.role === 'user').map((m) => m.content)).toEqual(['q3', 'q4', 'q5', 'q6', 'q7'])
  })

  it('shows the error and keeps the user message when the request fails', async () => {
    askHelp.mockRejectedValue(new Error('Service unavailable'))
    render(<HelpChat />)
    await open()
    await ask('How do I apply?')

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
    expect(screen.getByText('How do I apply?')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    render(<HelpChat />)
    await open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('traps Tab inside the panel and wraps at both edges', async () => {
    render(<HelpChat />)
    await open()
    // Enable Send (disabled while the draft is empty) so it is focusable.
    fireEvent.change(screen.getByLabelText('Message the help assistant'), { target: { value: 'hi' } })
    const send = screen.getByRole('button', { name: 'Send' })
    send.focus()
    // Forward Tab from the last control wraps to the first (close button).
    fireEvent.keyDown(send, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close help chat' })).toHaveFocus()
    // Shift+Tab from the first control wraps back to the last.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close help chat' }), { key: 'Tab', shiftKey: true })
    expect(send).toHaveFocus()
  })
})
