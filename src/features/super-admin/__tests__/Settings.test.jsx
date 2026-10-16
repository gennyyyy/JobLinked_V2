import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import Settings from '../Settings'
import { listReferenceData, addReferenceData, removeReferenceData } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({
  listReferenceData: vi.fn(),
  addReferenceData: vi.fn(),
  removeReferenceData: vi.fn(),
}))

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

  it('shows the loading screen while fetching reference data', () => {
    let resolveOne
    listReferenceData.mockReturnValue(new Promise((res) => { resolveOne = res }))
    render(<Settings />)
    expect(screen.getByText(/loading database/i)).toBeInTheDocument()
    act(() => resolveOne([]))
  })

  it('renders the reference values for each category', async () => {
    render(<Settings />)
    expect(await screen.findByText('Full-Time')).toBeInTheDocument()
    expect(screen.getByText('Part-Time')).toBeInTheDocument()
    expect(screen.getByText('High School')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Employment Types' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Education Levels' })).toBeInTheDocument()
  })

  it('adds a reference value to the employment category', async () => {
    render(<Settings />)
    await screen.findByText('Full-Time')

    fireEvent.change(screen.getByPlaceholderText(/add employment type/i), {
      target: { value: 'Contract' },
    })
    // The first Add button belongs to the employment section (declaration order).
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])

    await waitFor(() => expect(addReferenceData).toHaveBeenCalledWith('employment_type', 'Contract'))
  })

  it('removes a reference value after confirmation', async () => {
    render(<Settings />)
    // Remove the first employment value (Full-Time / id e1).
    fireEvent.click((await screen.findAllByRole('button', { name: 'Remove' }))[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Remove "Full-Time"?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(removeReferenceData).toHaveBeenCalledWith('e1'))
  })

  it('shows an error message when the reference data fails to load', async () => {
    listReferenceData.mockRejectedValueOnce(new Error('settings down'))
    render(<Settings />)
    expect(await screen.findByText('settings down')).toBeInTheDocument()
  })
})
