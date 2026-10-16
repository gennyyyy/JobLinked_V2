import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../services/seekers', () => ({
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
}))
vi.mock('../../services/documents', () => ({ signedUrl: vi.fn() }))

import { listSeekerEducation, listSeekerExperience } from '../../services/seekers'
import SeekerProfileCard from '../SeekerProfileCard'

const applicant = {
  seeker: {
    id: 's1',
    full_name: 'juan dela cruz',
    email: 'juan@example.com',
    phone: '0917',
    barangay_district: 'santa maria',
    skills: ['welding'],
    employment_status: 'Unemployed',
    preferred_position: 'welder, driver',
    preferred_location: 'santa maria',
  },
  resume: { id: 'r1', file_name: 'cv.pdf', file_path: 'resumes/u1/cv.pdf' },
}

describe('SeekerProfileCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders contact details and the fetched education/experience', async () => {
    listSeekerEducation.mockResolvedValue([
      { id: 'e1', level: 'college', school: 'sta maria', field: null, end_year: 2020 },
    ])
    listSeekerExperience.mockResolvedValue([
      { id: 'x1', position: 'Welder', company: 'Acme', start_date: '2019', end_date: null },
    ])
    render(<SeekerProfileCard applicant={applicant} />)

    expect(screen.getByText('juan@example.com')).toBeInTheDocument()
    expect(screen.getByText('welder, driver')).toBeInTheDocument()
    expect(await screen.findByText(/Sta Maria/)).toBeInTheDocument()
    expect(screen.getByText(/Welder . Acme/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View Resume \(cv\.pdf\)/ })).toBeInTheDocument()
  })

  it('falls back to empty credentials when the reads fail', async () => {
    listSeekerEducation.mockRejectedValue(new Error('nope'))
    listSeekerExperience.mockRejectedValue(new Error('nope'))
    render(<SeekerProfileCard applicant={applicant} />)

    expect(await screen.findByText('No education recorded.')).toBeInTheDocument()
    expect(screen.getByText('No work experience recorded.')).toBeInTheDocument()
    expect(screen.queryByText('Loading credentials…')).toBeNull()
  })
})
