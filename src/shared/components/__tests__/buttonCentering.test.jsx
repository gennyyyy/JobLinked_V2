import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LinkButton } from '../design'
import { Button } from '@/components/ui/button'

const ASYMMETRIC_ICON_PADDING = /has-data-\[icon=inline-(start|end)\]:p[lr]-/

describe('icon button content centering', () => {
  it('LinkButton keeps symmetric padding with a leading icon', () => {
    render(
      <MemoryRouter>
        <LinkButton href="/jobs">
          <svg data-icon="inline-start" />
          Go
        </LinkButton>
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: 'Go' })
    expect(link.className).not.toMatch(ASYMMETRIC_ICON_PADDING)
    expect(link.className).toContain('px-5')
  })

  it('Button keeps symmetric padding with a leading icon', () => {
    render(
      <Button>
        <svg data-icon="inline-start" />
        Save
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.className).not.toMatch(ASYMMETRIC_ICON_PADDING)
    expect(button.className).toContain('px-4')
  })
})
