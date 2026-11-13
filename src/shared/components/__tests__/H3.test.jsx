import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { H1, H3 } from '../design'

let reduced = false
class IOStub {
  static instances = []
  constructor(cb) { this.cb = cb; IOStub.instances.push(this) }
  observe() { this.cb([{ isIntersecting: true }], this) }
  unobserve() {}
  disconnect() { this.disconnected = true }
}
class IOStubSilent extends IOStub { observe() { /* stays hidden until scrolled */ } }

beforeEach(() => {
  window.IntersectionObserver = IOStub
  IOStub.instances = []
  vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') && reduced }))
})
afterEach(() => { reduced = false; vi.unstubAllGlobals(); delete window.IntersectionObserver; cleanup() })

describe('H3', () => {
  it('renders static when IntersectionObserver is missing', () => {
    delete window.IntersectionObserver
    const { container } = render(<H3 className="text-xs">Qualifications</H3>)
    const h3 = container.querySelector('h3')
    expect(h3).toHaveTextContent('Qualifications')
    expect(h3).not.toHaveAttribute('data-letter-reveal')
    expect(h3).not.toHaveAttribute('aria-label')
  })

  it('splits animated text into staggered letter spans with a11y labels', () => {
    const { container } = render(<H3>Apply today</H3>)
    const h3 = container.querySelector('h3')
    expect(h3).toHaveAttribute('aria-label', 'Apply today')
    expect(h3).toHaveAttribute('data-letter-reveal')
    const split = h3.querySelector('span[aria-hidden="true"]')
    expect(split).not.toBeNull()
    expect(split.textContent).toBe('Apply today') // spaces preserved as text nodes
    const letters = split.querySelectorAll('.ltr')
    expect(letters.length).toBe('Apply today'.replace(' ', '').length)
    expect(letters[0].style.animationDelay).toBe('0ms')
    expect(letters[1].style.animationDelay).toBe('25ms')
  })

  it('caps the stagger delay at 600ms', () => {
    const { container } = render(<H3>{'a'.repeat(40)}</H3>)
    const letters = container.querySelectorAll('.ltr')
    expect(letters[29].style.animationDelay).toBe('600ms')
  })

  it('renders unsplit for strings over 160 characters', () => {
    const { container } = render(<H3>{'word '.repeat(40)}</H3>)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
    expect(container.querySelectorAll('.ltr')).toHaveLength(0)
  })

  it('keeps the letter cascade under reduced motion (CSS fades only)', () => {
    reduced = true
    const { container } = render(<H3>Session Expiring</H3>)
    expect(container.querySelector('h3')).toHaveAttribute('data-letter-reveal')
    expect(container.querySelectorAll('.ltr').length).toBeGreaterThan(0)
  })

  it('stays hidden until observed, then reveals once', () => {
    window.IntersectionObserver = IOStubSilent
    const { container } = render(<H3>Journey</H3>)
    expect(container.querySelector('h3')).toHaveAttribute('data-state', 'hidden')
    IOStub.instances[0].cb([{ isIntersecting: true }], IOStub.instances[0])
    expect(container.querySelector('h3')).toHaveAttribute('data-state', 'run')
  })

  it('animated={false} renders plain text even with IO', () => {
    const { container } = render(<H3 animated={false}>Plain</H3>)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
  })

  it('non-string children render unchanged', () => {
    const { container } = render(<H3><span data-testid="x">JobLinked</span></H3>)
    expect(container.querySelector('h3').contains(container.querySelector('[data-testid="x"]'))).toBe(true)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
  })

  it('merges className with tailwind-merge (caller wins)', () => {
    const { container } = render(<H3 className="text-xs">X</H3>)
    expect(container.querySelector('h3').className).toContain('text-xs')
    expect(container.querySelector('h3').className).not.toContain('text-2xl') // no size leaks from base
  })

  it('size="display" adds the responsive display scale', () => {
    const { container } = render(<H3 size="display">Head</H3>)
    const cls = container.querySelector('h3').className
    expect(cls).toContain('text-xl')
    expect(cls).toContain('sm:text-2xl')
  })
})

describe('H1', () => {
  it('H1 splits composed hero text across br and span while keeping markup', () => {
    const { container } = render(
      <H1 className="hero">
        Connecting Local<br className="hidden sm:block" /> Talent with<br className="hidden sm:block" />{' '}
        <span className="text-primary">Local Opportunities.</span>
      </H1>
    )
    const h1 = container.querySelector('h1')
    expect(h1).toHaveAttribute('aria-label', 'Connecting Local Talent with Local Opportunities.')
    expect(h1.querySelectorAll('.ltr').length).toBe(44)
    expect(h1.querySelectorAll('br').length).toBe(2)
    const span = h1.querySelector('span.text-primary')
    expect(span).not.toBeNull()
    expect(span.querySelectorAll('.ltr').length).toBe(19)
    const letters = h1.querySelectorAll('.ltr')
    expect(letters[0].style.animationDelay).toBe('0ms')
    expect(letters[15].style.animationDelay).toBe('375ms')
  })

  it('H1 static path (animated=false) renders the hero text unsplit', () => {
    const { container } = render(<H1 animated={false}>Local <span className="text-primary">Opportunities.</span></H1>)
    expect(container.querySelector('h1')).not.toHaveAttribute('data-letter-reveal')
    expect(container.querySelectorAll('.ltr')).toHaveLength(0)
  })
})
