import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { render, cleanup } from '@testing-library/react'
import { CountUp } from '../design'

let reduced = false
class IOStub {
  static instances = []
  constructor(cb) { this.cb = cb; IOStub.instances.push(this) }
  observe() { this.cb([{ isIntersecting: true }], this) }
  unobserve() {}
  disconnect() { this.disconnected = true }
}
class IOStubSilent extends IOStub { observe() { /* stays hidden until scrolled */ } }

// Manual rAF queue: the count is deterministic frame by frame, nothing is left
// ticking after a test.
let frames
let nextFrameId
function runFrame(time) {
  const [id, callback] = frames.entries().next().value
  frames.delete(id)
  act(() => callback(time))
}

beforeEach(() => {
  reduced = false
  window.IntersectionObserver = IOStub
  IOStub.instances = []
  vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') && reduced }))
  frames = new Map()
  nextFrameId = 0
  vi.stubGlobal('requestAnimationFrame', (cb) => { frames.set(++nextFrameId, cb); return nextFrameId })
  vi.stubGlobal('cancelAnimationFrame', (id) => { frames.delete(id) })
})
afterEach(() => {
  reduced = false
  vi.unstubAllGlobals()
  delete window.IntersectionObserver
  cleanup()
})

describe('CountUp', () => {
  it('renders the final value without IntersectionObserver, never a zero frame', () => {
    delete window.IntersectionObserver
    const { container } = render(<CountUp value={101} className="stat" aria-label="Open jobs count" />)
    const p = container.querySelector('p.stat')
    expect(p).toHaveTextContent((101).toLocaleString())
    expect(p).not.toHaveTextContent(/^0$/)
    expect(p).toHaveAttribute('aria-label', 'Open jobs count')
    expect(frames.size).toBe(0)
  })

  it('still counts under reduced motion (a value change is not vestibular motion)', () => {
    reduced = true
    const { container } = render(<CountUp value={101} />)
    const p = container.querySelector('p')
    expect(p.textContent).toBe('0') // auto-fired in view, but not the final value
    expect(frames.size).toBe(1)
    runFrame(0)
    runFrame(300)
    expect(p.textContent).toBe(String(Math.round(101 * 0.875)))
    runFrame(600)
    expect(p.textContent).toBe((101).toLocaleString())
    expect(frames.size).toBe(0)
  })

  it('counts from zero to the final value after it comes into view', () => {
    window.IntersectionObserver = IOStubSilent
    const { container } = render(<CountUp value={101} />)
    const p = container.querySelector('p')
    expect(p.textContent).toBe('0')
    expect(frames.size).toBe(0)

    act(() => IOStub.instances[0].cb([{ isIntersecting: true }], IOStub.instances[0]))
    expect(p.textContent).toBe('0')

    runFrame(0)
    expect(p.textContent).toBe('0')
    runFrame(300) // halfway: eased 0.875
    expect(p.textContent).toBe(String(Math.round(101 * 0.875)))
    runFrame(600)
    expect(p.textContent).toBe((101).toLocaleString())
    expect(frames.size).toBe(0) // no interval or frame left running
  })

  it('renders a dash until the value arrives, then counts if already in view', () => {
    const { container, rerender } = render(<CountUp value={undefined} />)
    const p = container.querySelector('p')
    expect(p.textContent).toBe('—')
    expect(frames.size).toBe(0)

    rerender(<CountUp value={55} />)
    expect(p.textContent).toBe('0')
    runFrame(0)
    runFrame(600)
    expect(p.textContent).toBe((55).toLocaleString())
  })

  it('does not re-count when the value changes after the count finished', () => {
    const { container, rerender } = render(<CountUp value={101} />)
    const p = container.querySelector('p')
    runFrame(0)
    runFrame(600)
    expect(p.textContent).toBe((101).toLocaleString())

    rerender(<CountUp value={200} />)
    expect(p.textContent).toBe((200).toLocaleString())
    expect(frames.size).toBe(0)
  })
})
