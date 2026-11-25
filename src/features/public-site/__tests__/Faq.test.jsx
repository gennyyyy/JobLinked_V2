import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Faq from '../Faq'
import { FAQS } from '../../../shared/constants'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

describe('FAQ page', () => {
  it('lists every FAQ from the shared constant', () => {
    render(
      <MemoryRouter>
        <Faq />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument()
    FAQS.forEach((faq) => expect(screen.getByText(faq.question)).toBeInTheDocument())
  })

  it('shows the employer accreditation and data-use questions', () => {
    render(
      <MemoryRouter>
        <Faq />
      </MemoryRouter>
    )

    const questions = [
      'What documents do I need for employer accreditation?',
      'How long does employer accreditation take?',
      'Can I post jobs before my accreditation is approved?',
      'What happens if my accreditation is rejected?',
      'How is my data used on JobLinked?',
    ]

    questions.forEach((question) => expect(screen.getByText(question)).toBeInTheDocument())
  })

  it('links the PESO office address to its map pin', async () => {
    render(
      <MemoryRouter>
        <Faq />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Where is the PESO office/ }))

    const address = await screen.findByRole('link', { name: 'Poblacion, Santa Maria, Bulacan 3022' })
    expect(address).toHaveAttribute(
      'href',
      'https://www.bing.com/maps/default.aspx?v=2&pc=FACEBK&mid=8100&where1=14.818470214142%2C+120.95965451912&FORM=FBKPL1&name=Poblacion%2C+Santa+Maria%2C+Philippines%2C+3022&mkt=en-GB'
    )
    expect(address).toHaveAttribute('target', '_blank')
    expect(address).toHaveAttribute('rel', 'noreferrer')
  })
})
