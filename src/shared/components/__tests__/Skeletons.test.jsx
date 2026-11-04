import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  JobCardSkeleton,
  JobListSkeleton,
  StatCardSkeleton,
  StatRowSkeleton,
  PanelSkeleton,
  TableSkeleton,
  PageSkeleton,
} from '../Skeletons'

describe('Skeletons', () => {
  const cases = [
    ['JobCardSkeleton', <JobCardSkeleton key="a" />, /loading job/i],
    ['JobListSkeleton', <JobListSkeleton key="b" count={2} />, /loading jobs/i],
    ['StatRowSkeleton', <StatRowSkeleton key="d" />, /loading summary/i],
    ['PanelSkeleton', <PanelSkeleton key="e" />, /loading panel/i],
    ['TableSkeleton', <TableSkeleton key="f" />, /loading records/i],
    ['PageSkeleton', <PageSkeleton key="g" stats={2} />, /loading page/i],
  ]

  for (const [name, node, label] of cases) {
    it(`${name} marks itself busy and announces its status`, () => {
      const { container } = render(node)
      const busy = container.querySelector('[aria-busy="true"]')
      expect(busy).toBeInTheDocument()
      if (label) expect(screen.getByRole('status')).toHaveTextContent(label)
    })
  }

  it('StatCardSkeleton mirrors the stat tile geometry', () => {
    const { container } = render(<StatCardSkeleton />)
    expect(container.firstChild).toHaveClass('surface')
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(3)
  })

  it('JobListSkeleton renders the requested number of cards', () => {
    const { container } = render(<JobListSkeleton count={3} />)
    expect(container.querySelectorAll('.surface')).toHaveLength(3)
    // exactly one polite status for the whole list, not one per card
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('PageSkeleton renders a table instead of panels when asked', () => {
    const { container } = render(<PageSkeleton table label="Loading records…" />)
    expect(container.querySelectorAll('.surface')).toHaveLength(1)
  })
})
