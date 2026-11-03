import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PublicHeader from '../PublicHeader'
import PublicFooter from '../PublicFooter'

describe('PublicHeader', () => {
  it('renders LOG IN and SIGN UP links with the right destinations', () => {
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    )

    const login = screen.getByRole('link', { name: /log in/i })
    const signup = screen.getByRole('link', { name: /sign up/i })
    expect(login).toHaveAttribute('href', '/portals')
    expect(signup).toHaveAttribute('href', '/register')
  })

  it('opens the How It Works dropdown with the three destination links', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: /how it works/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    for (const [name, href] of [
      ['Jobseeker', '/register/job-seeker'],
      ['Employer', '/register/employer'],
      ['FAQ', '/portals'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
  })

  it('closes the dropdown on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: /how it works/i })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Jobseeker' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the dropdown on click outside', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: /how it works/i })
    await user.click(trigger)
    await user.click(document.body)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('PublicFooter', () => {
  it('renders all five column headings and the copyright line', () => {
    render(<PublicFooter />)

    for (const heading of [
      'Employer',
      'Jobseeker',
      'Program & Services',
      'Other Goods',
      'Connect with Us',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/Copyright ©/)).toHaveTextContent(
      `Copyright © ${new Date().getFullYear()} JobLinked. All Rights Reserved`,
    )
  })
})
