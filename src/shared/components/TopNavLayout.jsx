import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Search,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import SkipLink from './SkipLink'
import NotificationBell from './NotificationBell'
import DashboardFooter from './DashboardFooter'
import HelpChat from './HelpChat'
import { Logo } from './design'
import useAuth from '../hooks/useAuth'
import useAFKTimer from '../hooks/useAFKTimer'
import useDialog from '../hooks/useDialog'
import { initialsOf } from '../utils/accountName'
import { fetchAvatarObjectUrl } from '../services/images'
import { PORTAL_NAV, ROLE_LABELS } from '../constants'
import { listNotifications } from '../services/notifications'
import { NOTIFICATIONS_CHANGED } from '../utils/notificationEvents'
import { prefetchRoute } from '../lib/routeLoaders'
import { searchWorkspace } from '../lib/workspaceSearch'
import { getStats } from '../services/admin'
import { isUnprovisioned } from '../lib/api'
import { cn } from '@/lib/utils'

export default function TopNavLayout({ role, navItems, profileTo, roleLabel, homeTo, fixedContent = false }) {
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()
  const { logout, user, needsProvisioning } = useAuth()
  const isAdmin = role === 'super-admin'
  const label = roleLabel || ROLE_LABELS[role] || 'Workspace'
  const home = homeTo ?? `/${pathname.split('/')[1] || ''}`
  const navigation = navItems || PORTAL_NAV[role] || []
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showWarning, setShowWarning] = useState(false)
  const staySignedInRef = useRef(null)
  const [notificationRows, setNotificationRows] = useState([])
  const [pendingAccreditations, setPendingAccreditations] = useState(0)
  const [unprovisioned, setUnprovisioned] = useState(false)
  const handleWarning = useCallback(() => setShowWarning(true), [setShowWarning])
  useEffect(() => {
    if (showWarning) staySignedInRef.current?.focus()
  }, [showWarning])
  const afkRef = useDialog(() => setShowWarning(false), showWarning)
  useAFKTimer(true, handleWarning)

  // One fetch per signed-in user. The old version re-ran on every pathname
  // change, so every portal navigation cost two extra requests.
  useEffect(() => {
    if (!user?.id) return undefined
    let alive = true

    function refresh() {
      if (alive) setUnprovisioned(false)
      listNotifications(user.id)
        .then((rows) => { if (alive) setNotificationRows(rows || []) })
        .catch((err) => { if (alive && isUnprovisioned(err)) setUnprovisioned(true) })
      if (isAdmin) {
        getStats()
          .then((stats) => { if (alive) setPendingAccreditations(Number(stats?.pendingAccreditations) || 0) })
          .catch(() => {})
      }
    }

    // A read/delete elsewhere in the workspace refreshes the badge without a
    // full page reload; returning to the tab catches changes made in another one.
    function refreshWhenVisible() {
      if (!document.hidden) refresh()
    }

    refresh()
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      alive = false
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [user?.id, isAdmin])

  // Search results link to a section (#hash). Lazy routes and their data need a
  // moment to render the target, so retry briefly, then scroll and flash it.
  useEffect(() => {
    if (!hash) return undefined
    const id = hash.slice(1)
    let tries = 0
    let timer = 0

    function reveal() {
      const el = document.getElementById(id)
      if (!el) {
        if (tries++ < 40) timer = window.setTimeout(reveal, 50)
        return
      }
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      el.animate?.(
        [
          { outline: '2px solid transparent', outlineOffset: '4px' },
          { outline: '2px solid var(--primary)', outlineOffset: '4px' },
          { outline: '2px solid transparent', outlineOffset: '4px' },
        ],
        { duration: 1500 },
      )
    }

    reveal()
    return () => window.clearTimeout(timer)
  }, [pathname, hash])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const unread = notificationRows.filter((row) => !row.is_read).length
  const activePath = pathname.split('/')[2] || 'dashboard'
  const activeItem = navigation.find((item) => {
    const itemPath = item.path.split('/').filter(Boolean).pop()
    return itemPath === activePath || (item.end && item.path === pathname)
  })
  const pageLabel = activeItem?.label ?? 'Workspace'
  const name = user?.full_name || user?.name || user?.email || 'Workspace'
  const initials = initialsOf(user, name)

  // Profile picture for the signed-in seeker (ADR-040). The endpoint needs the
  // bearer token, so it is fetched as an object URL; initials are the fallback.
  const [avatarUrl, setAvatarUrl] = useState(null)
  const avatarUrlRef = useRef('')
  useEffect(() => {
    if (!user?.id || user?.has_avatar !== true) return undefined
    let live = true
    fetchAvatarObjectUrl(user.id)
      .then((url) => {
        if (!live) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current)
        avatarUrlRef.current = url || ''
        setAvatarUrl(url || null)
      })
      .catch(() => { /* unavailable */ })
    return () => {
      live = false
      if (avatarUrlRef.current) {
        URL.revokeObjectURL(avatarUrlRef.current)
        avatarUrlRef.current = ''
      }
    }
  }, [user?.id, user?.has_avatar])
  useEffect(() => () => {
    if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current)
  }, [])

  const sidebar = (small = false) => (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-[85px] items-center px-6', collapsed && !small && 'justify-center px-0')}>
        <Logo compact={collapsed && !small} />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label={`${label} navigation`}>
        {navigation.map(({ label: title, path, icon: Icon, end }) => {
          const active = end ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
          const badge = path.endsWith('/notifications') ? unread : isAdmin && path.endsWith('/accreditation') ? pendingAccreditations : 0
          return (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={() => setMobile(false)}
              onMouseEnter={() => prefetchRoute(path)}
              onFocus={() => prefetchRoute(path)}
              title={collapsed && !small ? title : undefined}
              aria-label={title}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-navy',
                active && 'bg-blue-soft font-medium text-primary',
                collapsed && !small && 'justify-center px-1',
              )}
            >
              {Icon ? <Icon className="size-[17px] shrink-0" strokeWidth={1.7} /> : null}
              {(!collapsed || small) && (
                <>
                  <span className="flex-1">{title}</span>
                  {badge > 0 && (
                    <span className={cn('flex size-5 items-center justify-center rounded-md text-[9px]', path.endsWith('/accreditation') ? 'bg-warning-soft text-warning' : 'bg-primary/10 text-primary')}>
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )

  const results = searchOpen
    ? query.trim()
      ? searchWorkspace(query, role)
      : navigation.map((item) => ({ title: item.label, subtitle: 'Workspace page', href: item.path }))
    : []

  return (
    <div className={cn('min-h-screen bg-muted/70', fixedContent && 'h-screen overflow-hidden')}>
      <SkipLink />
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden border-r bg-white transition-[width] lg:block', collapsed ? 'w-[82px]' : 'w-[248px]')}>
        {sidebar()}
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[290px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
            <SheetDescription>Navigate your role-based workspace.</SheetDescription>
          </SheetHeader>
          {sidebar(true)}
        </SheetContent>
      </Sheet>
      <div className={cn('flex min-h-screen flex-col transition-[margin]', collapsed ? 'lg:ml-[82px]' : 'lg:ml-[248px]', fixedContent && 'h-screen min-h-0 overflow-hidden')}>
        <header className="sticky top-0 z-20 flex h-[74px] shrink-0 items-center justify-between gap-3 border-b bg-white/95 px-5 backdrop-blur-sm lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open workspace navigation" onClick={() => setMobile(true)}>
              <Menu />
            </Button>
            <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-[11px] sm:flex">
              <Link to={home} className="text-muted-foreground">Workspace</Link>
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="truncate font-medium text-navy">{pageLabel}</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className="mr-3 hidden min-h-10 w-[210px] items-center gap-2 rounded-lg border bg-muted/50 px-3 text-[11px] text-muted-foreground md:flex" onClick={() => setSearchOpen(true)}>
              <Search className="size-3.5" />
              Search your workspace…
            </button>
            <button className="flex size-11 items-center justify-center text-muted-foreground md:hidden" aria-label="Search workspace" onClick={() => setSearchOpen(true)}>
              <Search className="size-4" />
            </button>
            <NotificationBell rows={notificationRows} />
            <span className="hidden h-7 w-px bg-border sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" />}>
                <Avatar>
                  {user?.has_avatar === true && avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left sm:block">
                  <span className="block text-[11px] font-medium text-navy">{name}</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{label}</span>
                </span>
                <ChevronDown className="hidden sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate(profileTo || home)}>
                    <Settings />
                    Account settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <ArrowUpRight />
                    Public website
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={cn('w-full flex-1 p-5 sm:p-7 lg:p-8', fixedContent && 'min-h-0 overflow-hidden')}>
          <div className={cn('space-y-8', fixedContent && 'h-full min-h-0')}>
            {unprovisioned ? (
              <section aria-labelledby="registration-title" className="max-w-2xl rounded-xl border bg-white p-6 sm:p-8">
                <h1 id="registration-title" className="text-xl font-semibold text-navy">Complete your registration</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Choose the registration path that matches your account to finish setting up your JobLinked profile.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/complete-registration?role=job-seeker" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Job seeker registration
                  </Link>
                  <Link to="/complete-registration?role=employer" className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium text-navy hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Employer registration
                  </Link>
                </div>
              </section>
            ) : <Outlet />}
          </div>
        </main>
        <DashboardFooter />
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Find your way around.</DialogTitle>
            <DialogDescription>Search pages and settings in your workspace.</DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupInput aria-label="Workspace search" placeholder="Search pages…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-col gap-1">
            {results.length ? (
              results.map((result) => (
                <Link key={result.href} to={result.href} onClick={() => setSearchOpen(false)} className="flex min-h-16 items-center justify-between rounded-lg p-3 hover:bg-muted">
                  <span>
                    <span className="block text-xs font-medium text-navy">{result.title}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">{result.subtitle}</span>
                  </span>
                  <ArrowUpRight className="size-4 text-primary" />
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No matching pages.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Floating help: mounted once here so every portal using this shell gets it. */}
      {user && !needsProvisioning && <HelpChat />}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div ref={afkRef} role="dialog" aria-modal="true" aria-labelledby="afk-title" className="mx-4 max-w-sm rounded-lg border border-primary bg-card p-5 shadow-xl">
            <h3 id="afk-title" className="mb-2 text-lg font-bold text-foreground">Session Expiring</h3>
            <p className="mb-6 text-sm text-muted-foreground">You will be logged out in 1 minute due to inactivity. Move your mouse or press a key to stay signed in.</p>
            <div className="flex gap-2">
              <Button onClick={handleLogout} className="flex-1 border border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sign Out</Button>
              <Button ref={staySignedInRef} onClick={() => setShowWarning(false)} className="flex-1 bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90">Stay Signed In</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
