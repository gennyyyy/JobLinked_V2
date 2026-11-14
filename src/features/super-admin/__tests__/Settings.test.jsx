import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../shared/services/admin', () => ({
  listReferenceData: vi.fn(),
  addReferenceData: vi.fn(),
  removeReferenceData: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({
    user: { id: 'a1', role: 'super-admin', full_name: 'peso admin', email: 'admin@example.com' },
  }),
}))

import { listReferenceData, addReferenceData, removeReferenceData } from '../../../shared/services/admin'
import Settings from '../Settings'

const EMPLOYMENT = [
  { id: 'e1', category: 'employment_type', value: 'Full-time', sort_order: 1 },
  { id: 'e2', category: 'employment_type', value: 'Part-time', sort_order: 2 },
]
const EDUCATION = [
  { id: 'd1', category: 'education_level', value: 'College', sort_order: 1 },
]

const renderPage = () => render(<MemoryRouter><Settings /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  listReferenceData.mockImplementation((category) => Promise.resolve(
    category === 'employment_type' ? EMPLOYMENT : EDUCATION,
  ))
  addReferenceData.mockResolvedValue({ id: 'e3', category: 'employment_type', value: 'Seasonal', sort_order: 0 })
  removeReferenceData.mockResolvedValue({ deleted: true })
})

describe('super-admin Settings', () => {
  it('lists both reference categories under one page heading', async () => {
    renderPage()

    expect(await screen.findByText('Full-time')).toBeInTheDocument()
    expect(screen.getByText('College')).toBeInTheDocument()
    expect(screen.getByText('Employment types')).toBeInTheDocument()
    expect(screen.getByText('Education levels')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('adds a value to a category', async () => {
    renderPage()
    await screen.findByText('Full-time')

    fireEvent.change(screen.getByLabelText('New employment type'), { target: { value: 'Seasonal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add employment type' }))

    await waitFor(() => expect(addReferenceData).toHaveBeenCalledWith('employment_type', 'Seasonal'))
    expect(await screen.findByText('Seasonal')).toBeInTheDocument()
    expect(screen.getByLabelText('New employment type')).toHaveValue('')
  })

  it('removes a value after confirmation', async () => {
    renderPage()
    await screen.findByText('Full-time')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Full-time' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/remove "full-time" from employment types\?/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(removeReferenceData).toHaveBeenCalledWith('e1'))
    await waitFor(() => expect(screen.queryByText('Full-time')).toBeNull())
  })

  it('shows the server 409 duplicate message inline', async () => {
    addReferenceData.mockRejectedValueOnce(
      Object.assign(new Error('Reference value already exists'), { status: 409 }),
    )
    renderPage()
    await screen.findByText('Full-time')

    fireEvent.change(screen.getByLabelText('New employment type'), { target: { value: 'Full-time' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add employment type' }))

    expect(await screen.findByText('Reference value already exists')).toBeInTheDocument()
    expect(screen.getAllByText('Full-time')).toHaveLength(1)
  })

  it('shows an empty state per category when no values exist', async () => {
    listReferenceData.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No employment types yet')).toBeInTheDocument()
    expect(screen.getByText('No education levels yet')).toBeInTheDocument()
  })

  it('shows a load error without hiding the other category', async () => {
    listReferenceData.mockImplementation((category) => (category === 'employment_type'
      ? Promise.reject(new Error('load failed'))
      : Promise.resolve(EDUCATION)))
    renderPage()

    expect(await screen.findByText('load failed')).toBeInTheDocument()
    expect(screen.getByText('College')).toBeInTheDocument()
  })
})
