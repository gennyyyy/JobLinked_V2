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

  it('countUp leaves non-numbers as plain text (type gate)', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'State', value: '42', icon: NoIcon }]} />)
    expect(container.textContent).toContain('42')
    expect(container.textContent).not.toContain('—')
  })

  it('countUp falls back for non-finite values', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'Broken', value: Infinity, icon: NoIcon }]} />)
    expect(container.textContent).toContain('Infinity')
    expect(container.textContent).not.toContain('—')
  })

  it('countUp handles zero and keeps the value classes', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'Empty', value: 0, icon: NoIcon }]} />)
    const p = container.querySelector('p')
    expect(p).toHaveTextContent('0')
    expect(p.className).toContain('text-3xl')
  })
})
