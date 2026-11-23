import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Register from '../Register'

function renderPage() {
  return render(<MemoryRouter><Register /></MemoryRouter>)
}

describe('Register chooser', () => {
  it('shows the accreditation note only under the employer card, after its button', () => {
    renderPage()

    const note = screen.getByText('Requires PESO Accreditation')
    const employerCard = screen.getByRole('link', { name: /Join as an employer/ }).closest('.surface')
    const seekerCard = screen.getByRole('link', { name: /Join as a job seeker/ }).closest('.surface')

    expect(employerCard).toContainElement(note)
    expect(seekerCard).not.toContainElement(note)
    expect(
      note.compareDocumentPosition(screen.getByRole('link', { name: /Join as an employer/ }))
      & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy()
  })

  it('makes both journey links full width', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /Join as a job seeker/ })).toHaveClass('w-full')
    expect(screen.getByRole('link', { name: /Join as an employer/ })).toHaveClass('w-full')
  })

  it('shows a note under each journey button in the same slot', () => {
    renderPage()

    const employerNote = screen.getByText('Requires PESO Accreditation')
    const seekerNote = screen.getByText('Requires Email Verification')
    const seekerLink = screen.getByRole('link', { name: /Join as a job seeker/ })

    expect(employerNote).toHaveClass('mt-3', 'min-h-5')
    expect(seekerNote).toHaveClass('mt-3', 'min-h-5')
    expect(seekerLink.closest('.surface')).toContainElement(seekerNote)
    expect(
      seekerNote.compareDocumentPosition(seekerLink) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy()
  })
})
