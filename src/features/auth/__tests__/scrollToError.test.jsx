import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobSeekerRegister from '../JobSeekerRegister'

function fillAllButBirthdate() {
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Juan' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } })
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'juan@example.com' } })
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '9171234567' } })
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
  fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /agree to the municipal/i }))
  fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
}

describe('scroll to first error', () => {
  it('moves to the date picker when birthday is the unfilled info', async () => {
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    render(<MemoryRouter><JobSeekerRegister /></MemoryRouter>)
    fillAllButBirthdate()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/birthday is required/i)).toBeInTheDocument())
    await waitFor(() => expect(document.activeElement?.id).toBe('birthdate'))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    expect(document.getElementById('birthdate')?.style.scrollMarginTop).toBe('')
    spy.mockRestore()
  })

  it('picks the visually-first error, not validation order (birthday before email)', async () => {    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    render(<MemoryRouter><JobSeekerRegister /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Juan' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/birthday is required/i)).toBeInTheDocument())
    await waitFor(() => expect(document.activeElement?.id).toBe('birthdate'))
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('highlights every empty required field via the error selector', async () => {
    render(<MemoryRouter><JobSeekerRegister /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/first name is required/i)).toBeInTheDocument())
    const highlighted = [...document.querySelectorAll('.register-form div:has(> p.text-danger.text-xs) input, .register-form div:has(> p.text-danger.text-xs) select')]
      .map((el) => el.id)
    expect(highlighted).toEqual(expect.arrayContaining([
      'firstName', 'lastName', 'birthdate', 'mobileNumber', 'email',
      'password', 'confirmPassword', 'employmentStatus', 'streetAddress',
      'cityMunicipality', 'provinceState', 'agree', 'confirmAccurate',
    ]))
  })

  it('removes a consent checkbox highlight once it is ticked', async () => {
    render(<MemoryRouter><JobSeekerRegister /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/you must agree to the terms/i)).toBeInTheDocument())
    const highlighted = () => [...document.querySelectorAll('.register-form div:has(> p.text-danger.text-xs) input, .register-form div:has(> p.text-danger.text-xs) select')].map((el) => el.id)
    expect(highlighted()).toContain('agree')
    expect(highlighted()).toContain('confirmAccurate')

    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
    await waitFor(() => expect(screen.queryByText(/confirm your information is true and correct/i)).not.toBeInTheDocument())
    expect(highlighted()).not.toContain('confirmAccurate')
    expect(highlighted()).toContain('agree')

    fireEvent.click(screen.getByRole('checkbox', { name: /agree to the municipal/i }))
    await waitFor(() => expect(screen.queryByText(/you must agree to the terms/i)).not.toBeInTheDocument())
    expect(highlighted()).not.toContain('agree')
  })
})
