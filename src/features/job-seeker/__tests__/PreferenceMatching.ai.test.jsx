import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PreferenceMatching from '../PreferenceMatching'

const PRIVACY = 'Your request is processed by an AI provider to rank vacancies. Never include personal details; your name and resume are never sent.'

function renderPanel(props = {}) {
  return render(<PreferenceMatching prompt="" onSubmit={vi.fn()} {...props} />)
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'AI job matching' }))
}

describe('PreferenceMatching dialog copy', () => {
  it('shows the privacy line and no placeholder copy', () => {
    renderPanel()
    openDialog()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Describe your ideal job')).toBeInTheDocument()
    expect(screen.getByText('Send your preferences to start the matching experience.')).toBeInTheDocument()
    expect(screen.getByText(PRIVACY)).toBeInTheDocument()
    expect(screen.queryByText(/No actual AI service is connected/)).toBeNull()
    expect(screen.queryByText(/keyword overlap/i)).toBeNull()
  })

  it('shows the model ranking state in the header', () => {
    renderPanel({ mode: 'ai' })
    expect(screen.getByText('AI ranking active')).toBeInTheDocument()
  })

  it('shows the standard matching state when no model ranking is active', () => {
    renderPanel({ mode: 'deterministic' })
    expect(screen.getByText('Standard matching · no AI')).toBeInTheDocument()
  })

  it('disables Send while a ranking request is in flight', () => {
    renderPanel({ compact: true, prompt: 'Night shift only', busy: true })
    openDialog()
    fireEvent.change(screen.getByLabelText('Your job preferences'), { target: { value: 'Night shift only' } })

    expect(screen.getByRole('button', { name: /send preferences/i })).toBeDisabled()
  })

  it('caps the preference input at the endpoint limit', () => {
    renderPanel()
    openDialog()

    expect(screen.getByLabelText('Your job preferences')).toHaveAttribute('maxlength', '500')
  })
})
