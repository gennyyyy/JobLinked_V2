import { describe, it, expect } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobCard from '../JobCard'
import { matchJob } from '../../utils/jobDisplay'

const BASE = {
  id: 'j1',
  title: 'Warehouse Helper',
  status: 'published',
  location: 'Poblacion',
  employment_type: 'Full-time',
  created_at: new Date().toISOString(),
  employers: { company_name: 'santa maria logistics', accreditation_status: 'approved' },
}

const job = (overrides = {}) => ({ ...BASE, ...overrides })

function renderCard(overrides = {}, props = {}) {
  render(
    <MemoryRouter>
      <JobCard job={job(overrides)} href="/jobs/j1" {...props} />
    </MemoryRouter>,
  )
  return screen.getByText('Warehouse Helper').closest('.job-card')
}

describe('JobCard display separation', () => {
  it('renders field, skills, and highlights as separate labelled groups', () => {
    const card = renderCard({
      field: 'Logistics & Delivery',
      skills: ['Driving', 'Inventory'],
      tags: ['Urgent Hiring', 'Day Shift'],
      work_arrangement: 'On-site',
    })

    expect(within(card).getByText('Logistics & Delivery')).toBeInTheDocument()

    const skills = within(card).getByRole('group', { name: 'Skills required' })
    expect(within(skills).getByText('Driving')).toBeInTheDocument()
    expect(within(skills).getByText('Inventory')).toBeInTheDocument()

    const highlights = within(card).getByRole('group', { name: 'Job highlights' })
    expect(within(highlights).getByText('Urgent Hiring')).toBeInTheDocument()
    expect(within(highlights).getByText('Day Shift')).toBeInTheDocument()
    expect(within(highlights).queryByText('Driving')).toBeNull()
  })

  it('shows the work arrangement in the meta line, never inside a tag group', () => {
    const card = renderCard({
      // No "Experience:" line: the old helper fell back to the arrangement here.
      requirements: '',
      work_arrangement: 'Hybrid',
      skills: ['Driving'],
      tags: ['Urgent Hiring'],
    })

    const meta = within(card).getByText('Poblacion').closest('[data-slot="card-description"]')
    expect(within(meta).getByText('Hybrid')).toBeInTheDocument()
    expect(within(card).getAllByText('Hybrid')).toHaveLength(1)
    expect(within(within(card).getByRole('group', { name: 'Skills required' })).queryByText('Hybrid')).toBeNull()
    expect(within(within(card).getByRole('group', { name: 'Job highlights' })).queryByText('Hybrid')).toBeNull()
  })

  it('renders no empty groups or match badge for a legacy vacancy', () => {
    const user = { skills: ['Driving'] }
    const legacy = { title: 'Warehouse Helper', description: '', requirements: '', tags: [], skills: [] }
    const card = renderCard({ field: null, office: null, employment_type: null }, {
      showMatch: true,
      match: matchJob(legacy, user),
    })

    expect(card.querySelectorAll('[role="group"]')).toHaveLength(0)
    expect(within(card).queryByText(/% skills overlap/)).toBeNull()
    expect(within(card).queryByText(/listed skills match/)).toBeNull()
  })

  it('only marks a badge as verified when the employer is accredited', () => {
    const pending = renderCard({ employers: { company_name: 'unvetted corp', accreditation_status: 'pending' } })
    expect(within(pending).queryByText('Verified employer')).toBeNull()
    expect(within(pending).getByText('Unvetted Corp')).toBeInTheDocument()

    cleanup()
    const approved = renderCard()
    expect(within(approved).getByText('Verified employer')).toBeInTheDocument()
  })

  it('keeps the match badge and line consistent with matchJob for structured skills', () => {
    const overrides = { skills: ['MS Excel', 'Cashiering'] }
    const card = renderCard(overrides, { showMatch: true, match: matchJob(job(overrides), { skills: ['MS Excel'] }) })

    expect(within(card).getByText('50% skills overlap')).toBeInTheDocument()
    expect(within(card).getByText('1 of 2 listed skills match: MS Excel.')).toBeInTheDocument()
  })

  it('falls back to the legacy office label when a vacancy has no field', () => {
    const card = renderCard({ field: null, office: 'Santa Maria Office' })
    expect(within(card).getByText('Santa Maria Office')).toBeInTheDocument()
  })
})

describe('JobCard company logo', () => {
  const EMPLOYER_ID = '22222222-2222-2222-2222-222222222222'
  const LOGO_AT = '2026-01-01T00:00:00.000Z'
  const withLogo = { id: EMPLOYER_ID, company_name: 'santa maria logistics', logo_updated_at: LOGO_AT }

  it('shows the versioned employer logo when the embed carries one', () => {
    const card = renderCard({ employers: withLogo })

    const img = card.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toContain(`/employers/${EMPLOYER_ID}/logo`)
    expect(img.getAttribute('src')).toContain('?v=')
    expect(img).toHaveAttribute('alt', '')
  })

  it('renders initials when the employer has no logo', () => {
    const card = renderCard()

    expect(card.querySelector('img')).toBeNull()
    expect(within(card).getByText('S')).toBeInTheDocument()
  })

  it('falls back to initials when the logo image errors', () => {
    const card = renderCard({ employers: withLogo })
    const img = card.querySelector('img')

    fireEvent.error(img)

    expect(card.querySelector('img')).toBeNull()
    expect(within(card).getByText('S')).toBeInTheDocument()
  })
})
