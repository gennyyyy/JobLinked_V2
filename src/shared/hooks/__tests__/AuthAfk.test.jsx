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

  it('logs out at 5min', () => {
    vi.useFakeTimers()
    try {
      const logout = vi.fn()
      useAuth.mockReturnValue({ user: { id: 'u1' }, logout })
      function Harness() {
        useAFKTimer(true, vi.fn())
        return null
      }
      render(<MemoryRouter><Harness /></MemoryRouter>)
      act(() => { vi.advanceTimersByTime(4 * 60 * 1000) })
      expect(logout).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(60 * 1000) })
      expect(logout).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sets no timers when disabled or when there is no user', () => {
    vi.useFakeTimers()
    try {
      const logout = vi.fn()
      const onWarning = vi.fn()
      useAuth.mockReturnValue({ user: { id: 'u1' }, logout })
      function Disabled() {
        useAFKTimer(false, onWarning)
        return null
      }
      const { unmount } = render(<MemoryRouter><Disabled /></MemoryRouter>)
      act(() => { vi.advanceTimersByTime(6 * 60 * 1000) })
      expect(onWarning).not.toHaveBeenCalled()
      expect(logout).not.toHaveBeenCalled()
      unmount()

      useAuth.mockReturnValue({ user: null, logout })
      function NoUser() {
        useAFKTimer(true, onWarning)
        return null
      }
      render(<MemoryRouter><NoUser /></MemoryRouter>)
      act(() => { vi.advanceTimersByTime(6 * 60 * 1000) })
      expect(onWarning).not.toHaveBeenCalled()
      expect(logout).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets the clock on user activity', () => {
    vi.useFakeTimers()
    try {
      useAuth.mockReturnValue({ user: { id: 'u1' }, logout: vi.fn() })
      const onWarning = vi.fn()
      function Harness() {
        useAFKTimer(true, onWarning)
        return null
      }
      render(<MemoryRouter><Harness /></MemoryRouter>)
      act(() => { vi.advanceTimersByTime(3 * 60 * 1000) })
      act(() => { document.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })) })
      act(() => { vi.advanceTimersByTime(3 * 60 * 1000) })
      expect(onWarning).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(60 * 1000) })
      expect(onWarning).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears timers on unmount', () => {
    vi.useFakeTimers()
    try {
      const logout = vi.fn()
      useAuth.mockReturnValue({ user: { id: 'u1' }, logout })
      const onWarning = vi.fn()
      function Harness() {
        useAFKTimer(true, onWarning)
        return null
      }
      const { unmount } = render(<MemoryRouter><Harness /></MemoryRouter>)
      unmount()
      act(() => { vi.advanceTimersByTime(6 * 60 * 1000) })
      expect(onWarning).not.toHaveBeenCalled()
      expect(logout).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not throw without an onWarning callback', () => {
    vi.useFakeTimers()
    try {
      const logout = vi.fn()
      useAuth.mockReturnValue({ user: { id: 'u1' }, logout })
      function Harness() {
        useAFKTimer(true)
        return null
      }
      render(<MemoryRouter><Harness /></MemoryRouter>)
      act(() => { vi.advanceTimersByTime(4 * 60 * 1000) })
      act(() => { vi.advanceTimersByTime(60 * 1000) })
      expect(logout).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
