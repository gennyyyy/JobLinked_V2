import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from '../Settings'
import { listReferenceData, addReferenceData, removeReferenceData } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({
  listReferenceData: vi.fn(),
  addReferenceData: vi.fn(),
  removeReferenceData: vi.fn(),
}))

const renderSettings = () => render(<MemoryRouter><Settings /></MemoryRouter>)

const EMPLOYMENT = [{ id: 'e1', value: 'Full-Time' }, { id: 'e2', value: 'Part-Time' }]
const EDUCATION = [{ id: 'ed1', value: 'High School' }]

describe('System Settings reference data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addReferenceData.mockResolvedValue({})
    removeReferenceData.mockResolvedValue({})
    listReferenceData.mockImplementation((category) =>
      Promise.resolve(category === 'employment_type' ? EMPLOYMENT : EDUCATION)
    )
  })

  it('shows a layout skeleton while fetching reference data', () => {
    let resolveOne
    listReferenceData.mockReturnValue(new Promise((res) => { resolveOne = res }))
    renderSettings()
    expect(screen.getByRole('status')).toHaveTextContent(/loading panel/i)
    act(() => resolveOne([]))
  })

  it('renders the reference values for each category', async () => {
    renderSettings()
    expect(await screen.findByText('Full-Time')).toBeInTheDocument()
    expect(screen.getByText('Part-Time')).toBeInTheDocument()
    expect(screen.getByText('High School')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Employment Types' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Education Levels' })).toBeInTheDocument()
  })

  it('adds a reference value to the employment category', async () => {
    renderSettings()
    await screen.findByText('Full-Time')

    fireEvent.change(screen.getByPlaceholderText(/add employment type/i), {
      target: { value: 'Contract' },
    })
    // The first Add button belongs to the employment section (declaration order).
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])

    await waitFor(() => expect(addReferenceData).toHaveBeenCalledWith('employment_type', 'Contract'))
  })

  it('removes a reference value after confirmation', async () => {
    renderSettings()
    // Remove the first employment value (Full-Time / id e1).
    fireEvent.click((await screen.findAllByRole('button', { name: 'Remove' }))[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Remove "Full-Time"?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(removeReferenceData).toHaveBeenCalledWith('e1'))
  })

  it('shows an error message when the reference data fails to load', async () => {
    listReferenceData.mockRejectedValueOnce(new Error('settings down'))
    renderSettings()
    expect(await screen.findByText('settings down')).toBeInTheDocument()
  })
})
