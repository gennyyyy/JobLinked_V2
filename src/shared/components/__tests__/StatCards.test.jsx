import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StatCards } from '../design'

// StatCards requires an icon component per stat; a stub keeps the assertions
// on the value paragraph alone.
const NoIcon = () => null

afterEach(() => cleanup())

describe('StatCards', () => {
  it('default off renders the raw value', () => {
    const { container } = render(<StatCards stats={[{ label: 'Users', value: 1234, icon: NoIcon }]} />)
    expect(container.textContent).toContain('1234')
    expect(container.textContent).not.toContain('1,234')
  })

  it('countUp formats numeric values through CountUp', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'Users', value: 1234, icon: NoIcon }]} />)
    expect(container.textContent).toContain('1,234')
  })

  it('countUp leaves non-numeric values as plain text', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'State', value: '—', icon: NoIcon }]} />)
    expect(container.textContent).toContain('—')
  })
})
