import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, Routes, Route } from 'react-router-dom'
import StaticUrlRouter from '../StaticUrlRouter'

function Page({ name }) {
  return (
    <div>
      <h1>{name}</h1>
      <Link to={name === 'Home' ? '/second' : '/first'}>{name === 'Home' ? 'Go second' : 'Go first'}</Link>
    </div>
  )
}

function renderApp(entry = '/first') {
  return render(
    <StaticUrlRouter entry={entry}>
      <Routes>
        <Route path="/first" element={<Page name="Home" />} />
        <Route path="/second" element={<Page name="Second" />} />
        <Route path="/login" element={<Page name="Home" />} />
        <Route path="/reset-password" element={<Page name="Reset" />} />
      </Routes>
    </StaticUrlRouter>
  )
}

describe('StaticUrlRouter', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('renders the route for the entry path', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('navigates without touching the URL', async () => {
    const before = window.location.href
    renderApp()

    await userEvent.click(screen.getByRole('link', { name: /go second/i }))

    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument()
    expect(window.location.href).toBe(before)
  })

  it('shows the app root instead of the page the tab was opened on', () => {
    window.history.replaceState(null, '', '/login')
    renderApp('/login')

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('keeps a one-time auth URL so a refresh can resume it', () => {
    window.history.replaceState(null, '', '/reset-password?code=x')
    renderApp('/reset-password?code=x')

    expect(screen.getByRole('heading', { name: 'Reset' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/reset-password')
    expect(window.location.search).toBe('?code=x')
  })
})
