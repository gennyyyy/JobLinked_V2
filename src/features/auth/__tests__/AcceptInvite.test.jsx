import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AcceptInvite from '../AcceptInvite'

function renderPage(entry = '/accept-invite') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/reset-password" element={<div>reset password page</div>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AcceptInvite', () => {
  // ADR-056: an invite is a Better Auth reset link, so the invitation's
  // credential is the reset token. The screen forwards it, never consumes it.
  it('forwards an invite token to the reset-password screen', async () => {
    renderPage('/accept-invite?token=tok_invite')

    expect(await screen.findByText('reset password page')).toBeInTheDocument()
  })

  it('keeps the invalid-link notice when the link has no token', () => {
    renderPage('/accept-invite')

    expect(screen.getByText('This invite link is invalid or expired.')).toBeInTheDocument()
    expect(screen.getByText('Go to sign in')).toBeInTheDocument()
  })
})
