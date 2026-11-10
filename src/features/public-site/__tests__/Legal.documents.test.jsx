import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Legal from '../Legal'
import { PRIVACY_NOTICE, TERMS_OF_USE } from '../../../shared/content/legal'

// G2: the two routes used to render one shared placeholder body. They must now be
// different documents, and the registration consent must reuse the privacy notice
// rather than keeping a second copy.
function renderDoc(document, title) {
  return render(
    <MemoryRouter>
      <Legal title={title} document={document} />
    </MemoryRouter>
  )
}

describe('legal documents', () => {
  it('renders the privacy notice on /privacy', () => {
    renderDoc('privacy', 'Privacy notice')
    expect(screen.getByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
    expect(screen.getByText(/Data Privacy Act of 2012, RA 10173/)).toBeInTheDocument()
    expect(screen.queryByText(/Acceptable use/)).toBeNull()
  })

  it('renders the terms of use on /terms', () => {
    renderDoc('terms', 'Terms of Use')
    expect(screen.getByRole('heading', { name: 'Terms of Use' })).toBeInTheDocument()
    expect(screen.getByText(/Acceptable use/)).toBeInTheDocument()
    expect(screen.queryByText(/Data Privacy Act of 2012, RA 10173/)).toBeNull()
  })

  it('keeps the documents distinct', () => {
    expect(PRIVACY_NOTICE).not.toBe(TERMS_OF_USE)
    expect(PRIVACY_NOTICE.length).toBeGreaterThan(1500)
    expect(TERMS_OF_USE.length).toBeGreaterThan(1200)
  })
})
