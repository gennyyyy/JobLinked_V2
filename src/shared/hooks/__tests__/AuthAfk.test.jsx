import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../useAuth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, default: vi.fn() }
})

import useAuth from '../useAuth'
import { AuthContext } from '../useAuth'
import useAFKTimer from '../useAFKTimer'

describe('Auth merge + AFK direct callback', () => {
  it('exports AuthContext from useAuth', () => {
    expect(AuthContext).toBeTruthy()
    expect(AuthContext.Provider).toBeTruthy()
  })

  it('fires onWarning at 4min via direct callback arg', () => {
    vi.useFakeTimers()
    try {
      useAuth.mockReturnValue({ user: { id: 'u1' }, logout: vi.fn() })
      const onWarning = vi.fn()
      function Harness() {
        useAFKTimer(true, onWarning)
        return null
      }
      render(<MemoryRouter><Harness /></MemoryRouter>)
      expect(onWarning).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(4 * 60 * 1000) })
      expect(onWarning).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
