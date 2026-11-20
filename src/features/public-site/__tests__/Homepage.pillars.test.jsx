import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../Landing'
import { MATCHING_NAME, MATCHING_NOTICE } from '../../../shared/content/matching'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  getPublicStats: vi.fn().mockResolvedValue({ openJobs: 12, jobSeekers: 30, employers: 6, barangaysCovered: 4 }),
}))

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )
}

describe('Homepage revision: matching, accreditation, tracking', () => {
  it('leads with skills-based matching, not the keyword search', () => {
    renderLanding()

    const primary = screen.getByRole('link', { name: 'Find jobs matched to my skills' })
    expect(primary).toHaveAttribute('href', '/jobs')

    // The keyword/barangay form stays, explicitly secondary.
    expect(document.getElementById('home-search-label')).toHaveTextContent('Search all jobs')
    expect(screen.getByRole('form', { name: 'Search all jobs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search all jobs' })).toHaveAttribute('type', 'submit')

    const postJob = screen.getAllByRole('link', { name: 'Post a job' })
    expect(postJob.length).toBeGreaterThan(0)
    for (const link of postJob) expect(link).toHaveAttribute('href', '/register/employer')
  })

  it('replaces the generic steps with three linked pillars', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 3, name: MATCHING_NAME })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'PESO-accredited employers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Application & employment tracking' })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'See matched jobs' })).toHaveAttribute('href', '/jobs')
    expect(screen.getByRole('link', { name: 'How accreditation works' })).toHaveAttribute('href', '/how-it-works')
    expect(screen.getByRole('link', { name: 'How tracking works' })).toHaveAttribute('href', '/how-it-works')

    expect(screen.queryByText('Create your profile')).toBeNull()
    expect(screen.queryByText('Explore opportunities')).toBeNull()
    expect(screen.queryByText('Apply and stay in the loop')).toBeNull()
  })

  it('states the matching pillar in the canonical skills-based terms', () => {
    renderLanding()

    // Same sentences as every other match surface — imported, not re-typed.
    expect(screen.getByText(MATCHING_NOTICE)).toBeInTheDocument()
    expect(screen.getByText(MATCHING_NAME)).toBeInTheDocument()
  })

  it('claims neither a hiring score nor a guaranteed job', () => {
    renderLanding()

    const section = document.getElementById('how-it-works')
    expect(section).toHaveTextContent('It is not a hiring score or a guarantee.')
    expect(within(section).queryByText(/guaranteed|\b100%\b|success rate/i)).toBeNull()
    expect(within(section).queryByText(/hiring score (?:of|:)/i)).toBeNull()
  })
})
