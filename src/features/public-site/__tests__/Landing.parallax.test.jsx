import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../Landing'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

// jsdom has no scroll timelines and no CSS cascade, so this pins the markup the
// parallax utilities hang off and proves the page still renders without motion.
describe('Landing parallax structure', () => {
  it('keeps the drifting background layer inside the clipped hero section', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    const layers = document.querySelectorAll('.parallax-bg')
    expect(layers).toHaveLength(1)

    const hero = layers[0].closest('section')
    expect(hero).not.toBeNull()
    expect(hero.className).toContain('overflow-hidden')
    expect(hero.querySelector('h1')).toBeInTheDocument()
  })

  it('marks below-fold containers for the view-timeline reveal', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    expect(document.querySelectorAll('.parallax-reveal').length).toBeGreaterThan(0)
  })
})
