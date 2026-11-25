import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StatusBadge } from '../design'

afterEach(() => cleanup())

describe('StatusBadge', () => {
  it('normalizes raw statuses to the right tone and label', () => {
    const { container: active } = render(<StatusBadge status="active" />)
    expect(active.textContent).toBe('Active')
    expect(active.firstChild.className).toContain('bg-success-soft')

    const { container: suspended } = render(<StatusBadge status="suspended" />)
    expect(suspended.textContent).toBe('Suspended')
    expect(suspended.firstChild.className).toContain('bg-danger-soft')

    const { container: pending } = render(<StatusBadge status="Pending Review" />)
    expect(pending.textContent).toBe('Pending Review')
    expect(pending.firstChild.className).toContain('bg-warning-soft')
  })
})
