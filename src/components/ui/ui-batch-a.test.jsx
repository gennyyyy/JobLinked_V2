import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'
import { Card, CardHeader, CardTitle } from './card'
import { Skeleton } from './skeleton'
import { Empty, EmptyHeader, EmptyTitle } from './empty'

describe('ui batch A smoke', () => {
  it('renders primitives with data-slot', () => {
    const { container } = render(
      <>
        <Button variant="outline">Click</Button>
        <Card><CardHeader><CardTitle>T</CardTitle></CardHeader></Card>
        <Skeleton className="h-4 w-10" />
        <Empty><EmptyHeader><EmptyTitle>None</EmptyTitle></EmptyHeader></Empty>
      </>,
    )
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="empty"]')).toBeTruthy()
    expect(screen.getByText('Click')).toBeInTheDocument()
  })
})
