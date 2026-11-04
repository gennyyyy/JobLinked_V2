import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Component, Suspense } from 'react'
import { render, waitFor } from '@testing-library/react'
import { lazyRoute } from '../routeLoaders'

class Boundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() { /* expected in this test */ }

  render() {
    return this.state.failed ? <p>failed</p> : this.props.children
  }
}

const renderRoute = (Route) => render(
  <Boundary>
    <Suspense fallback={<p>loading</p>}>
      <Route />
    </Suspense>
  </Boundary>,
)

describe('lazyRoute', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('reloads once when a chunk fails to load', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true, configurable: true })
    const Broken = lazyRoute(() => Promise.reject(new Error('chunk gone')))

    const { findByText } = renderRoute(Broken)

    expect(await findByText('failed')).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload a second time in the same session', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true, configurable: true })
    sessionStorage.setItem('joblinked:route-reload', '1')
    const Broken = lazyRoute(() => Promise.reject(new Error('chunk gone')))

    const { findByText } = renderRoute(Broken)

    expect(await findByText('failed')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('clears the reload flag once a chunk loads', async () => {
    const Route = lazyRoute(() => Promise.resolve({ default: () => <p>ok</p> }))
    sessionStorage.setItem('joblinked:route-reload', '1')

    const { findByText } = renderRoute(Route)

    expect(await findByText('ok')).toBeInTheDocument()
    await waitFor(() => expect(sessionStorage.getItem('joblinked:route-reload')).toBeNull())
  })
})
