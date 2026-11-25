import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LinkExpired from '../LinkExpired'

function renderPage(entry = '/link-expired') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/link-expired" element={<LinkExpired />} />
        <Route path="/forgot-password" element={<div>forgot password page</div>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LinkExpired', () => {
  it('shows one expired-link title for every type', () => {
    renderPage('/link-expired?type=reset')

    expect(screen.getByRole('heading', { level: 1, name: 'This link has expired.' })).toBeInTheDocument()
    expect(screen.getByText('It’s no longer valid.')).toBeInTheDocument()
  })

  it('offers a new reset link and sign-in for an expired reset link', () => {
    renderPage('/link-expired?type=reset')

    expect(screen.getByText('This password reset link is invalid or has expired.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })

  it('sends an expired verification link to sign-in only', () => {
    renderPage('/link-expired?type=verify')

    expect(screen.getByText('This verification link is invalid or has expired.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Request a new reset link' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })

  it('sends an expired invite link to sign-in only', () => {
    renderPage('/link-expired?type=invite')

    expect(screen.getByText('This invite link is invalid or has expired. Ask your administrator to send a new invite.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Request a new reset link' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })

  it('falls back to the generic copy when the type is missing', () => {
    renderPage()

    expect(screen.getByText('This link is invalid or has expired.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeInTheDocument()
  })

  it('falls back to the generic copy when the type is unknown', () => {
    renderPage('/link-expired?type=bogus')

    expect(screen.getByText('This link is invalid or has expired.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toBeInTheDocument()
  })
})
