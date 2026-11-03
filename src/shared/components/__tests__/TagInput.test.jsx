import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagInput } from '../TagInput'

function Controlled({ max }) {
  const [value, setValue] = useState('')
  return <TagInput value={value} onChange={setValue} max={max} placeholder="Search for skills" />
}

// Comma-terminated input commits the tag, same as pressing Enter.
function typeTag(tag) {
  fireEvent.change(screen.getByLabelText('Search for skills'), { target: { value: `${tag},` } })
}

describe('TagInput max', () => {
  it('caps the tags at max and ignores extras', () => {
    render(<Controlled max={3} />)

    typeTag('Welding')
    typeTag('Cooking')
    typeTag('Driving')
    typeTag('Plumbing')

    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(3)
    expect(screen.queryByLabelText('Remove Plumbing')).toBeNull()
  })

  it('stays unlimited when max is not set', () => {
    render(<Controlled />)

    typeTag('Welding')
    typeTag('Cooking')
    typeTag('Driving')
    typeTag('Plumbing')

    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(4)
  })
})
