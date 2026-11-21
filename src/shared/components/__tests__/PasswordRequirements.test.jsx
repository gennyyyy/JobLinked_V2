import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PasswordRequirements from '../PasswordRequirements'

const LABELS = [
  'At least 8 characters',
  'One letter',
  'One number',
  'One symbol (e.g. ! @ # $)',
]

function renderItems(value) {
  render(<PasswordRequirements value={value} />)
  return within(screen.getByRole('list', { name: /password requirements/i })).getAllByRole('listitem')
}

describe('PasswordRequirements', () => {
  it('renders the four rule labels', () => {
    renderItems('')
    for (const label of LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('marks every rule unmet for an empty value', () => {
    const items = renderItems('')
    expect(items).toHaveLength(4)
    for (const [index, label] of LABELS.entries()) {
      expect(items[index]).toHaveTextContent(`Not met: ${label}`)
    }
  })

  it('marks every rule met for a valid password', () => {
    const items = renderItems('password123!')
    for (const [index, label] of LABELS.entries()) {
      expect(items[index]).toHaveTextContent(`Met: ${label}`)
    }
  })

  it('shows mixed state while the password is still weak', () => {
    const items = renderItems('password')
    expect(items[0]).toHaveTextContent('Met: At least 8 characters')
    expect(items[1]).toHaveTextContent('Met: One letter')
    expect(items[2]).toHaveTextContent('Not met: One number')
    expect(items[3]).toHaveTextContent('Not met: One symbol (e.g. ! @ # $)')
  })

  it('keeps the state glyph out of the accessible name', () => {
    const items = renderItems('password123!')
    const glyph = items[0].querySelector('svg')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
  })
})
