import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../Landing'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  getPublicStats: vi.fn().mockResolvedValue({ openJobs: 12, employers: 6, barangaysCovered: 4 }),
}))

// Every landing-page CTA must point at a route that exists in App.jsx.
// /signup*, /login, /about, /faq, /peso-services, /jobs/job-1 were all dead
// (the catch-all sent them back to "/").
const expected = [
  ['Find your next job', '/jobs'],
  ['Post a job', '/register/employer'],
  ["Let's get started", '/signup'],
  ['Sign up', '/signup'],
  ['Log in', '/login'],
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
    expect(screen.getAllByRole('link', { name: /peso services/i })[0]).toHaveAttribute('href', '/peso-services')
  })

  it('places the community snapshot and about sections around PESO services', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    const stats = screen.getByRole('heading', { name: 'Local connections. Real potential.' }).closest('section')
    const services = screen.getByRole('heading', { name: "You don't have to take the next step alone." }).closest('section')
    const about = screen.getByRole('heading', { name: 'Built around people, not paperwork.' }).closest('section')

    expect(stats.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(services.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('gives every landing link a real destination', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    screen.getAllByRole('link').forEach((link) => {
      expect(link.getAttribute('href'), link.textContent).toBeTruthy()
    })
  })

  it('points the fixed links at their destinations', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Administrative' })).toHaveAttribute('href', '/jobs?keyword=Administrative')
    expect(screen.getByRole('link', { name: 'Find your opportunity' })).toHaveAttribute('href', '/signup/jobseeker')
    expect(screen.getByRole('link', { name: 'Build your team' })).toHaveAttribute('href', '/signup/employer')
    expect(screen.getByRole('link', { name: 'Explore the PESO portal' })).toHaveAttribute('href', '/super-admin')
    expect(screen.getByRole('link', { name: 'Explore PESO services' })).toHaveAttribute('href', '/peso-services')
    expect(screen.getByRole('link', { name: 'Explore all FAQs' })).toHaveAttribute('href', '/faq')
  })
})
