import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import AcceptInvite from '../AcceptInvite'

function ExpiredStub() {
  const { search } = useLocation()
  return <div>link expired {search}</div>
}

function renderPage(entry = '/accept-invite') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/link-expired" element={<ExpiredStub />} />
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

  it('redirects to the expired-link page when the link has no token', async () => {
    renderPage('/accept-invite')

    expect(await screen.findByText('link expired ?type=invite')).toBeInTheDocument()
  })
})
