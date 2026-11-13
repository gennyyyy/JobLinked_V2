import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../Landing'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

// jsdom has no layout, so scrollIntoView does not exist until we stub it here.
let scrolls

beforeEach(() => {
  scrolls = []
  Element.prototype.scrollIntoView = function scrollIntoView(options) {
    scrolls.push({ target: this, options })
  }
})

function renderLanding(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Landing />
    </MemoryRouter>
  )
}

describe('Landing anchor scrolling', () => {
  it('scrolls to #faq on every click of the FAQ link', () => {
    renderLanding()

    const faqLink = screen.getByRole('link', { name: /frequently asked questions/i })
    const faq = document.getElementById('faq')

    fireEvent.click(faqLink)
    expect(scrolls).toHaveLength(1)
    expect(scrolls[0].target).toBe(faq)
    expect(scrolls[0].options).toEqual({ block: 'start' })

    // A repeat click pushes a new location with the same hash string. The scroll
    // must still run; this assertion is the regression guard for the old [hash] effect.
    fireEvent.click(faqLink)
    expect(scrolls).toHaveLength(2)
    expect(scrolls[1].target).toBe(faq)
  })

  it('scrolls to the anchor when the page mounts at /#faq', () => {
    renderLanding('/#faq')

    expect(scrolls).toHaveLength(1)
    expect(scrolls[0].target).toBe(document.getElementById('faq'))
  })
})
