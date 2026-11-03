import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplicantsShell from '../ApplicantsShell'

describe('ApplicantsShell', () => {
  it('renders the empty state with title and body', () => {
    render(
      <ApplicantsShell isEmpty emptyTitle="No applicants yet" emptyBody="None here." />
    )
    expect(screen.getByText('No applicants yet')).toBeInTheDocument()
    expect(screen.getByText('None here.')).toBeInTheDocument()
  })

  it('renders the clear-filters button only when onClearFilters is provided and fires it', () => {
    const onClear = vi.fn()
    const { rerender } = render(<ApplicantsShell isEmpty emptyTitle="Empty" />)
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument()

    rerender(<ApplicantsShell isEmpty emptyTitle="Empty" onClearFilters={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('marks the active filter card with aria-pressed and calls onFilterChange', () => {
    const onChange = vi.fn()
    render(
      <ApplicantsShell
        filters={[
          { value: 'all', label: 'All', count: 2, className: 'border-blue-300 bg-blue-50 text-blue-700' },
          { value: 'Interview', label: 'Interview', count: 1, className: 'border-purple-300 bg-purple-50 text-purple-700' },
        ]}
        activeFilter="Interview"
        onFilterChange={onChange}
      />
    )
    const interviewBtn = screen.getByRole('button', { name: /Interview/i })
    expect(interviewBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /All/i }))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('calls onSearchChange when typing in the search input', () => {
    const onSearch = vi.fn()
    render(<ApplicantsShell search="" onSearchChange={onSearch} />)
    fireEvent.change(screen.getByLabelText('Search applicants'), { target: { value: 'maria' } })
    expect(onSearch).toHaveBeenCalledWith('maria')
  })

  it('calls onSortChange when changing the sort select', () => {
    const onSort = vi.fn()
    render(<ApplicantsShell sort="newest" onSortChange={onSort} />)
    fireEvent.change(screen.getByLabelText('Sort applicants'), { target: { value: 'oldest' } })
    expect(onSort).toHaveBeenCalledWith('oldest')
  })

  it('renders children when not empty', () => {
    render(<ApplicantsShell isEmpty={false}><span>child content</span></ApplicantsShell>)
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})