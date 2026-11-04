import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import usePageTitle from '../usePageTitle'

describe('usePageTitle', () => {
  it('sets the route title, and the brand for unknown paths', () => {
    const { rerender } = renderHook(({ path }) => usePageTitle(path), { initialProps: { path: '/jobs' } })
    expect(document.title).toBe('Find local jobs — JobLinked')

    rerender({ path: '/nope' })
    expect(document.title).toBe('JobLinked')
  })
})
