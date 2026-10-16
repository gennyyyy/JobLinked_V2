import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PortalSelect from '../PortalSelect'

describe('PortalSelect contrast token (A2)', () => {
  it('keeps gray-400 only on the dark header and uses gray-500 for light text', () => {
    const { container } = render(
      <MemoryRouter>
        <PortalSelect />
      </MemoryRouter>,
    )

    // The sign-up nudge sits on the light page background → must be gray-500.
    const nudge = Array.from(container.querySelectorAll('p.text-gray-500')).find((p) =>
      p.textContent?.includes('account'),
    )
    expect(nudge).toBeTruthy()

    // gray-400 survives exactly once: the "PESO · SANTA MARIA" label on the
    // bg-dark-blue header, where it still clears ~6:1.
    const gray400 = Array.from(container.querySelectorAll('.text-gray-400'))
    expect(gray400).toHaveLength(1)
    expect(gray400[0].className).toContain('sm:block')
  })
})
