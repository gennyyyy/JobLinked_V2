import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SkipLink from '../SkipLink'

describe('SkipLink (WCAG 2.4.1 bypass block)', () => {
  it('is the first link, targets #main-content, and is programmatically hidden until focused', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toHaveAttribute('href', '#main-content')
    // sr-only until focus: the owning component pairs sr-only with focus:not-sr-only
    expect(link.className).toContain('sr-only')
    expect(link.className).toContain('focus:not-sr-only')
  })
})
