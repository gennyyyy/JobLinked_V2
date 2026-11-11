import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HowItWorks from '../HowItWorks'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

describe('HowItWorks Page', () => {
  it('renders heading and default jobseeker content', () => {
    render(
      <MemoryRouter>
        <HowItWorks />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: /how joblinked works/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /make room for your next chapter/i })).toBeInTheDocument()
    expect(screen.getByText(/create your profile/i)).toBeInTheDocument()
    expect(screen.getByText(/explore local opportunities/i)).toBeInTheDocument()
    expect(screen.getByText(/apply with confidence/i)).toBeInTheDocument()
    expect(screen.getByText(/stay in the loop/i)).toBeInTheDocument()

    const ctaLink = screen.getByRole('link', { name: /create a job seeker profile/i })
    expect(ctaLink).toHaveAttribute('href', '/register/job-seeker')
  })

  it('switches to employer tab content on click', () => {
    render(
      <MemoryRouter>
        <HowItWorks />
      </MemoryRouter>
    )

    const employerTab = screen.getByRole('button', { name: /for employers/i })
    fireEvent.click(employerTab)

    expect(screen.getByRole('heading', { level: 2, name: /your next great teammate is nearby/i })).toBeInTheDocument()
    expect(screen.getByText(/register your business/i)).toBeInTheDocument()
    expect(screen.getByText(/submit accreditation requirements/i)).toBeInTheDocument()
    expect(screen.getByText(/wait for peso demo approval/i)).toBeInTheDocument()
    expect(screen.getByText(/post, review, and connect/i)).toBeInTheDocument()

    const employerCta = screen.getByRole('link', { name: /register a local business/i })
    expect(employerCta).toHaveAttribute('href', '/register/employer')
  })

  it('does not display tab for PESO personnel', () => {
    render(
      <MemoryRouter>
        <HowItWorks />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: /for peso personnel/i })).not.toBeInTheDocument()
  })
})
