import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { H3 } from '../design'

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

  it('renders static under reduced motion even with IO available', () => {
    reduced = true
    const { container } = render(<H3>Session Expiring</H3>)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
    expect(container.querySelectorAll('.ltr')).toHaveLength(0)
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
