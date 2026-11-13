import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicJobs from '../PublicJobs'

vi.mock('@/shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

// The browser itself is covered by JobsBrowser.test.jsx; here we pin the props
// the public page hands it.
vi.mock('@/shared/components/JobsBrowser', () => ({
  default: ({ jobHref, eyebrow, title, description, initialQuery, initialBarangay }) => (
    <div>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <p>Query: {initialQuery}</p>
      <p>Barangay: {initialBarangay}</p>
      <a href={jobHref('job-9')}>Open job</a>
    </div>
  ),
}))

function renderPage(path = '/jobs') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PublicJobs />
    </MemoryRouter>,
  )
}

describe('PublicJobs', () => {
  it('hands JobsBrowser the public heading, copy, and job href', () => {
    renderPage()

    expect(screen.getByText('Public employment bulletins')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Find openings in Santa Maria' })).toBeInTheDocument()
    expect(screen.getByText('Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open job' })).toHaveAttribute('href', '/jobs/job-9')
  })

  it('seeds the search fields from the URL and defaults them empty', () => {
    const { unmount } = renderPage('/jobs?keyword=nurse&location=Guyong')

    expect(screen.getByText('Query: nurse')).toBeInTheDocument()
    expect(screen.getByText('Barangay: Guyong')).toBeInTheDocument()

    unmount()
    renderPage()

    expect(screen.getByText('Query:')).toBeInTheDocument()
    expect(screen.getByText('Barangay:')).toBeInTheDocument()
  })
})
