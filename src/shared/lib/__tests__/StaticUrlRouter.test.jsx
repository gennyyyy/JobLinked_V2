import { describe, it, expect } from 'vitest'
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

function renderApp() {
  return render(
    <StaticUrlRouter entry="/first">
      <Routes>
        <Route path="/first" element={<Page name="Home" />} />
        <Route path="/second" element={<Page name="Second" />} />
      </Routes>
    </StaticUrlRouter>
  )
}

describe('StaticUrlRouter', () => {
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
})
