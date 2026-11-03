import { Button } from "../../components/ui/button";
import { useState, useCallback, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import useAFKTimer from '../hooks/useAFKTimer'
import useDialog from '../hooks/useDialog'
import SkipLink from './SkipLink'
import NotificationBell from './NotificationBell'
import AccountMenu from './AccountMenu'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

function NavGroup({ item, pathname }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const active = item.children.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`))

  useEffect(() => {
    if (!open) return undefined
    function closeOnOutside(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-muted'}`}
      >
        {item.label}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg ">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-primary '}`}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopNavLayout({ navItems = [], profileTo, roleLabel, homeTo, fixedContent = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const home = homeTo ?? `/${location.pathname.split('/')[1] || ''}`
  const { logout, user } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const handleWarning = useCallback(() => setShowWarning(true), [])
  const afkRef = useDialog(() => setShowWarning(false), showWarning)
  useAFKTimer(true, handleWarning)

  function handleLogout() {
    logout()
    navigate('/')
  }

  const nav = (
    <nav aria-label="Portal navigation" className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => (
        item.children ? (
          <NavGroup key={`${item.label}-${location.pathname}`} item={item} pathname={location.pathname} />
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-muted'
              }`
            }
          >
            {item.label}
          </NavLink>
        )
      ))}
    </nav>
  )

  const right = (
    <div className="flex items-center gap-3">
      <NotificationBell />
      <AccountMenu user={user} profileTo={profileTo} roleLabel={roleLabel} onLogout={handleLogout} />
    </div>
  )

  return (
    <div className={`${fixedContent ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-muted text-foreground ${roleLabel === 'Super Admin' ? 'super-admin-layout' : ''}`}>
      <SkipLink />
      <SiteHeader homeTo={home} center={nav} right={right} />
      <main
        id="main-content"
        tabIndex={-1}
        className={fixedContent
          ? 'flex-1 min-h-0 min-w-0 w-full overflow-hidden px-4 py-4 md:px-[5%] md:py-5'
          : 'flex-1 w-full p-[5%] overflow-y-auto'}
      >
        <Outlet />
      </main>
      <div className={fixedContent ? 'shrink-0' : undefined}><SiteFooter /></div>
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            ref={afkRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="afk-title"
            className="bg-card border border-primary rounded-lg p-5 max-w-sm mx-4 shadow-xl"
          >
            <h3 id="afk-title" className="text-lg font-bold text-foreground mb-2">Session Expiring</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You will be logged out in 1 minute due to inactivity. Move your mouse or press a key to stay signed in.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleLogout}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted border border-border rounded-lg transition-colors"
              >
                Sign Out
              </Button>
              <Button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg active:scale-[0.98] transition-colors"
              >
                Stay Signed In
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
