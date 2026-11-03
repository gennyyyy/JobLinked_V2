import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../Landing'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

// Every landing-page CTA must point at a route that exists in App.jsx.
// /signup*, /login, /about, /faq, /peso-services, /jobs/job-1 were all dead
// (the catch-all sent them back to "/").
const expected = [
  ['Find your next job', '/jobs'],
  ['Post a job', '/register/employer'],
  ["Let's get started", '/register'],
  ['Create your profile', '/register'],
  ['Sign up', '/register'],
  ['Log in', '/portals'],
]

describe('Landing page routing', () => {
  it('points its calls to action at real routes', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    for (const [label, href] of expected) {
      const links = screen.getAllByRole('link', { name: new RegExp(label, 'i') })
      expect(links.length, label).toBeGreaterThan(0)
      for (const link of links) expect(link).toHaveAttribute('href', href)
    }
  })

  it('links in-page sections by anchor instead of missing pages', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    expect(document.getElementById('how-it-works')).toBeInTheDocument()
    expect(document.getElementById('about')).toBeInTheDocument()
    expect(document.getElementById('peso-services')).toBeInTheDocument()
    expect(document.getElementById('faq')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /peso services/i })[0]).toHaveAttribute('href', '/#peso-services')
  })
})
