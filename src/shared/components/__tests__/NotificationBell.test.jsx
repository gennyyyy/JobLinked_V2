import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))

import useAuth from '../../hooks/useAuth'
import { listNotifications, markRead } from '../../services/notifications'
import { NOTIFICATIONS_CHANGED } from '../../utils/notificationEvents'
import NotificationBell from '../NotificationBell'

const fixture = [{ id: '1', title: 'Hello', message: 'World', type: 'info', is_read: false, created_at: '2026-01-01' }]

const seeAllLink = () => screen.getByRole('link', { name: /see all/i })
const renderBell = (props) => render(<MemoryRouter><NotificationBell {...props} /></MemoryRouter>)
const panelOf = (trigger) => document.getElementById(trigger.getAttribute('aria-controls'))

function LocationProbe() {
  const { pathname } = useLocation()
  return <p>at:{pathname}</p>
}

describe('NotificationBell history link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reaches the portal notification history with the unread count', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const trigger = await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    expect(trigger).toHaveTextContent('1')
    fireEvent.click(trigger)
    expect(seeAllLink()).toHaveAttribute('href', '/employer/notifications')
  })

  it('renders without a badge when everything is read', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue([{ ...fixture[0], is_read: true }])
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const trigger = await screen.findByRole('button', { name: 'Notifications' })
    expect(trigger).not.toHaveTextContent('1')
    fireEvent.click(trigger)
    expect(seeAllLink()).toHaveAttribute('href', '/employer/notifications')
  })
})

describe('NotificationBell roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links job-seekers to their notification history', async () => {
    useAuth.mockReturnValue({ user: { id: 'u2', role: 'job-seeker' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }))
    expect(seeAllLink()).toHaveAttribute('href', '/job-seeker/notifications')
  })

  it('links super-admins to their notification history', async () => {
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'super-admin' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }))
    expect(seeAllLink()).toHaveAttribute('href', '/super-admin/notifications')
  })
})

describe('NotificationBell panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens on click and advances aria-expanded', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    const trigger = await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { name: 'Notification' })).toBeInTheDocument()
  })

  it('shows at most the newest five rows', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ ...fixture[0], id: `n${i}`, title: `Notice ${i + 1}` })),
    )
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (8 unread)' }))
    expect(screen.getByText('Notice 5')).toBeInTheDocument()
    expect(screen.queryByText('Notice 6')).toBeNull()
  })

  it('shows the empty copy when there are no rows', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue([])
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
  })

  it('marks an unread row as read on click, and leaves read rows alone', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    markRead.mockResolvedValue({})
    listNotifications.mockResolvedValue([
      { ...fixture[0], id: 'n1', title: 'Unread one' },
      { ...fixture[0], id: 'n2', title: 'Read one', is_read: true },
    ])
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Read one' }))
    expect(markRead).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Unread one' }))
    expect(markRead).toHaveBeenCalledWith('n1')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    const trigger = await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on an outside pointerdown', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }))
    expect(screen.getByRole('heading', { name: 'Notification' })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('heading', { name: 'Notification' })).toBeNull()
  })

  it('still navigates when markRead rejects, without floating the rejection', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue([
      { ...fixture[0], id: 'n1', title: 'Unread one', link: '/employer/job-posts/7' },
    ])
    // Vitest attaches its own handler to anything a spy returns, so a rejection
    // never reaches Node's unhandledRejection here — assert instead that the bell
    // hands a rejection handler to whatever markRead returns (a floated promise
    // would attach none).
    const onRejection = vi.fn(() => Promise.resolve())
    markRead.mockReturnValue({ catch: onRejection, then: () => Promise.resolve() })
    render(
      <MemoryRouter>
        <NotificationBell />
        <LocationProbe />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unread one' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(markRead).toHaveBeenCalledWith('n1')
    expect(onRejection).toHaveBeenCalled()
    expect(screen.getByText('at:/employer/job-posts/7')).toBeInTheDocument()
  })

  it('anchors the panel right by default and left when asked', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    const first = renderBell()
    const defaultTrigger = await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    fireEvent.click(defaultTrigger)
    expect(panelOf(defaultTrigger)).toHaveClass('right-0', 'origin-top-right')
    first.unmount()

    renderBell({ align: 'left' })
    const leftTrigger = await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    fireEvent.click(leftTrigger)
    expect(panelOf(leftTrigger)).toHaveClass('left-0', 'origin-top-left')
  })
})

describe('NotificationBell states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing and fetches nothing when logged out', async () => {
    useAuth.mockReturnValue({ user: null })
    const { container } = renderBell()
    expect(container.firstChild).toBeNull()
    expect(listNotifications).not.toHaveBeenCalled()
  })

  it('shows no badge when the fetch fails', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockRejectedValue(new Error('down'))
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const trigger = await screen.findByRole('button', { name: 'Notifications' })
    fireEvent.click(trigger)
    expect(seeAllLink()).toHaveAttribute('href', '/employer/notifications')
  })

  it('caps the badge at 9+ past nine unread', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ ...fixture[0], id: `n${i}` })),
    )
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const trigger = await screen.findByRole('button', { name: 'Notifications (12 unread)' })
    expect(trigger).toHaveTextContent('9+')
  })

  it('refreshes the badge when a notification change event fires', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    renderBell()
    await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    listNotifications.mockResolvedValue([{ ...fixture[0], is_read: true }])
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(2))
    const trigger = await screen.findByRole('button', { name: 'Notifications' })
    fireEvent.click(trigger)
    expect(seeAllLink()).toHaveAttribute('href', '/employer/notifications')
  })

  it('counts only unread notifications', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue([
      { ...fixture[0], id: 'n1', is_read: false },
      { ...fixture[0], id: 'n2', is_read: false },
      { ...fixture[0], id: 'n3', is_read: true },
    ])
    renderBell()
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const trigger = await screen.findByRole('button', { name: 'Notifications (2 unread)' })
    expect(trigger).toHaveTextContent('2')
  })
})
