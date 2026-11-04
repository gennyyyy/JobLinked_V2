import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import Employment from '../Employment'
import { listEmployment } from '../../../shared/services/seekers'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1' } }),
}))

vi.mock('../../../shared/services/seekers', () => ({
  listEmployment: vi.fn(),
}))

const CURRENT = {
  id: 'emp-1',
  employer_name: 'Acme Corp',
  position: 'Warehouse Associate',
  is_current: true,
  start_date: '2025-03-01',
  end_date: null,
}
const PAST = {
  id: 'emp-2',
  employer_name: 'Beta Foods',
  position: 'Cashier',
  is_current: false,
  start_date: '2023-01-01',
  end_date: '2024-06-30',
}

describe('Employment history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a layout skeleton while fetching employment records', () => {
    let resolveList
    listEmployment.mockReturnValue(new Promise((res) => { resolveList = res }))
    render(<Employment />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading page/i)
    act(() => resolveList([]))
  })

  it('renders employment records with their Current/Past status', async () => {
    listEmployment.mockResolvedValue([CURRENT, PAST])
    render(<Employment />)

    await screen.findAllByText('Acme Corp')
    expect(screen.getAllByText('Warehouse Associate').length).toBeGreaterThan(0)
    expect(screen.getByText('Beta Foods')).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getByText('Active')).toBeInTheDocument()
    expect(within(table).getByText('Separated')).toBeInTheDocument()
  })

  it('summarises the current employment in the stat panels', async () => {
    listEmployment.mockResolvedValue([CURRENT, PAST])
    render(<Employment />)

    await screen.findAllByText('Acme Corp')
    expect(screen.getByText('Currently employed')).toBeInTheDocument()
    expect(screen.getAllByText('Warehouse Associate').length).toBeGreaterThan(1)
  })

  it('renders the empty state when there are no records', async () => {
    listEmployment.mockResolvedValue([])
    render(<Employment />)
    expect(await screen.findByText('No employment records yet.')).toBeInTheDocument()
  })

  it('filters to current employment', async () => {
    listEmployment.mockResolvedValue([CURRENT, PAST])
    render(<Employment />)
    await screen.findAllByText('Acme Corp')

    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'current' } })

    expect(screen.queryByText('Beta Foods')).not.toBeInTheDocument()
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0)
  })

  it('shows an error message when the records fail to load', async () => {
    listEmployment.mockRejectedValue(new Error('boom'))
    render(<Employment />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
