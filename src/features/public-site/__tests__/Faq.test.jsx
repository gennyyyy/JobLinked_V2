import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
