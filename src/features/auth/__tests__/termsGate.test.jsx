import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobSeekerRegister from '../JobSeekerRegister'

function renderPage() {
  return render(<MemoryRouter><JobSeekerRegister /></MemoryRouter>)
}

function fillValid() {
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Juan' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } })
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'juan@example.com' } })
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '9171234567' } })
  fireEvent.change(screen.getByLabelText(/birthday/i), { target: { value: '1990-05-04' } })
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
  fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
}

describe('terms gate', () => {
  it('locks the agree box until terms are opened', async () => {
    renderPage()
    const agree = screen.getByRole('checkbox', { name: /agree to the municipal/i })
    expect(agree).toBeDisabled()
    expect(screen.getByText(/read the terms before agreeing/i)).toBeInTheDocument()
    const priorOverflow = document.body.style.overflow
    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    await waitFor(() => expect(agree).toBeEnabled())
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() => expect(document.body.style.overflow).toBe(priorOverflow))
  })

  it('blocks submit when terms were never opened', async () => {
    renderPage()
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(screen.getByText(/you must agree to the terms/i)).toBeInTheDocument())
  })
})
