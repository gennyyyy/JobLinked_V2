import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  deleteNotification: vi.fn(),
}))

import useAuth from '../../hooks/useAuth'
import { listNotifications, markRead, deleteNotification } from '../../services/notifications'
import NotificationsPage from '../NotificationsPage'
import { resolveNotificationLink } from '../../utils/notificationLinks'

const rows = [
  { id: 'n1', title: 'First', message: 'Hello', type: 'info', is_read: false, created_at: '2026-01-01' },
  { id: 'n2', title: 'Second', message: 'World', type: 'info', is_read: false, created_at: '2026-01-02' },
]

describe('NotificationsPage delete', () => {
  const renderPage = (ui = <NotificationsPage />) =>
    render(<MemoryRouter>{ui}</MemoryRouter>)

  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    listNotifications.mockResolvedValue(rows)
    deleteNotification.mockResolvedValue({ deleted: true })
  })

  it('select checkbox enables Delete selected', async () => {
    renderPage()
    await screen.findByText('First')
    const bulk = screen.getByRole('button', { name: /Delete selected \(0\)/ })
    expect(bulk).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification First' }))
    expect(screen.getByRole('button', { name: /Delete selected \(1\)/ })).toBeEnabled()
  })

  it('Select all selects every row and enables Delete selected', async () => {
    renderPage()
    await screen.findByText('First')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all notifications' }))
    expect(screen.getByRole('checkbox', { name: 'Select notification First' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select notification Second' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Delete selected \(2\)/ })).toBeEnabled()
  })

  it('Select all again clears the selection', async () => {
    renderPage()
    await screen.findByText('First')
    const all = screen.getByRole('checkbox', { name: 'Select all notifications' })
    await userEvent.click(all)
    await userEvent.click(all)
    expect(screen.getByRole('checkbox', { name: 'Select notification First' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: /Delete selected \(0\)/ })).toBeDisabled()
  })

  it('Select all is indeterminate when only some rows are selected', async () => {
    renderPage()
    await screen.findByText('First')
    const all = screen.getByRole('checkbox', { name: 'Select all notifications' })
    expect(all.indeterminate).toBe(false)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification First' }))
    expect(all.indeterminate).toBe(true)
  })

  it('per-row Delete removes row', async () => {
    renderPage()
    await screen.findByText('First')
    const dels = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(dels[0])
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith('n1'))
    expect(screen.queryByText('First')).toBeNull()
    expect(screen.getByText('Second')).toBeTruthy()
    expect(await screen.findByText('Notification deleted.')).toBeTruthy()
  })

  it('bulk delete removes selected', async () => {
    renderPage()
    await screen.findByText('First')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification First' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification Second' }))
    await userEvent.click(screen.getByRole('button', { name: /Delete selected \(2\)/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('First')).toBeNull()
    expect(screen.queryByText('Second')).toBeNull()
    expect(await screen.findByText('2 notification(s) deleted.')).toBeTruthy()
  })

  it('partial failure removes only successes and shows error', async () => {
    deleteNotification.mockImplementation((id) =>
      id === 'n1' ? Promise.resolve({ deleted: true }) : Promise.reject(new Error('boom'))
    )
    renderPage()
    await screen.findByText('First')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification First' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification Second' }))
    await userEvent.click(screen.getByRole('button', { name: /Delete selected \(2\)/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('First')).toBeNull()
    expect(screen.getByText('Second')).toBeTruthy()
    expect(await screen.findByText('Deleted 1 of 2, 1 failed')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Delete selected \(1\)/ })).toBeTruthy()
  })

  it('Select all then uncheck one row is indeterminate', async () => {
    renderPage()
    await screen.findByText('First')
    const all = screen.getByRole('checkbox', { name: 'Select all notifications' })
    await userEvent.click(all)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification First' }))
    expect(all.indeterminate).toBe(true)
  })

  it('per-row delete after Select all keeps remaining rows checked', async () => {
    renderPage()
    await screen.findByText('First')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all notifications' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => expect(screen.queryByText('First')).toBeNull())
    expect(screen.getByRole('checkbox', { name: 'Select notification Second' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Delete selected \(1\)/ })).toBeEnabled()
  })

  it('unreadOnly filter prunes selection to visible rows', async () => {
    const allRows = [
      { id: 'u1', title: 'Unread A', message: 'm', type: 'info', is_read: false, created_at: '2026-01-01' },
      { id: 'u2', title: 'Unread B', message: 'm', type: 'info', is_read: false, created_at: '2026-01-02' },
      { id: 'r1', title: 'Read A', message: 'm', type: 'info', is_read: true, created_at: '2026-01-03' },
      { id: 'r2', title: 'Read B', message: 'm', type: 'info', is_read: true, created_at: '2026-01-04' },
    ]
    listNotifications.mockImplementation((_id, { unreadOnly } = {}) =>
      Promise.resolve(unreadOnly ? allRows.filter((n) => !n.is_read) : allRows)
    )
    renderPage()
    await screen.findByText('Unread A')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all notifications' }))
    expect(screen.getByRole('button', { name: /Delete selected \(4\)/ })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Unread only' }))
    await waitFor(() => expect(screen.queryByText('Read A')).toBeNull())
    expect(screen.getByRole('button', { name: /Delete selected \(2\)/ })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: /Delete selected \(2\)/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledTimes(2))
    expect(deleteNotification).toHaveBeenCalledWith('u1')
    expect(deleteNotification).toHaveBeenCalledWith('u2')
    expect(deleteNotification).not.toHaveBeenCalledWith('r1')
    expect(deleteNotification).not.toHaveBeenCalledWith('r2')
  })

  it('Select all is disabled with zero notifications', async () => {
    listNotifications.mockResolvedValue([])
    renderPage()
    await screen.findByText('No notifications yet.')
    expect(screen.getByRole('checkbox', { name: 'Select all notifications' })).toBeDisabled()
  })

  it('Clear selection clears a partial selection', async () => {
    renderPage()
    await screen.findByText('First')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select notification First' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByRole('checkbox', { name: 'Select notification First' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: /Delete selected \(0\)/ })).toBeDisabled()
  })

  it('View details renders an SPA link to the stored destination', async () => {
    listNotifications.mockResolvedValue([
      { id: 'n9', title: 'Placed', message: 'ok', type: 'application', is_read: false, created_at: '2026-01-01', link: '/job-seeker/applications' },
    ])
    renderPage()
    const link = await screen.findByRole('link', { name: /View details/ })
    expect(link).toHaveAttribute('href', '/job-seeker/applications')
  })

  it('View details marks the notification read on click', async () => {
    markRead.mockResolvedValue({ ok: true })
    listNotifications.mockResolvedValue([
      { id: 'n9', title: 'Placed', message: 'ok', type: 'application', is_read: false, created_at: '2026-01-01', link: '/job-seeker/applications' },
    ])
    renderPage()
    await userEvent.click(await screen.findByRole('link', { name: /View details/ }))
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('n9'))
  })

  it('hides View details for external or malformed links', async () => {
    listNotifications.mockResolvedValue([
      { id: 'x1', title: 'Bad', message: 'm', type: 'system', is_read: false, created_at: '2026-01-01', link: 'https://evil.example/x' },
      { id: 'x2', title: 'Worse', message: 'm', type: 'system', is_read: false, created_at: '2026-01-01', link: 'javascript:alert(1)' },
    ])
    renderPage()
    await screen.findByText('Bad')
    expect(screen.queryByRole('link', { name: /View details/ })).toBeNull()
  })
})

describe('resolveNotificationLink', () => {
  it('keeps valid in-portal destinations', () => {
    expect(resolveNotificationLink({ link: '/employer/applicants' }, 'employer')).toBe('/employer/applicants')
    expect(resolveNotificationLink({ link: '/super-admin/job-posts' }, 'super-admin')).toBe('/super-admin/job-posts')
  })

  it('remaps the legacy employer jobs path to job-posts', () => {
    expect(resolveNotificationLink({ link: '/employer/jobs' }, 'employer')).toBe('/employer/job-posts')
  })

  it('scopes public job links into the seeker portal', () => {
    expect(resolveNotificationLink({ link: '/jobs/abc' }, 'job-seeker')).toBe('/job-seeker/jobs/abc')
  })

  it('rejects external and malformed links', () => {
    expect(resolveNotificationLink({ link: 'https://evil.example/x' }, 'employer')).toBeNull()
    expect(resolveNotificationLink({ link: 'javascript:alert(1)' }, 'employer')).toBeNull()
    expect(resolveNotificationLink({ link: '' }, 'employer')).toBeNull()
  })
})
