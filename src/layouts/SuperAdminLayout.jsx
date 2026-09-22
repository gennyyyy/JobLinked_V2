import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const navItems = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/accreditation', label: 'Accreditation' },
  { to: '/super-admin/employees', label: 'Employees' },
  { to: '/super-admin/job-posts', label: 'Job Posts' },
  { to: '/super-admin/roles', label: 'Roles' },
  { to: '/super-admin/users', label: 'Users' },
]

const AFK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const WARNING_TIME = 4 * 60 * 1000; // 4 minutes

function SuperAdminLayout() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const timeoutRef = useRef(null)
  const warningTimeoutRef = useRef(null)

  function handleLogout() {
    logout()
    navigate('/')
  }

  function resetAFKTimer() {
    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    setShowWarning(false)

    // Set warning timeout at 4 minutes
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
    }, WARNING_TIME)

    // Set logout timeout at 5 minutes
    timeoutRef.current = setTimeout(() => {
      logout()
      navigate('/')
    }, AFK_TIMEOUT)
  }

  // Setup AFK timer on mount
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    const handleActivity = () => {
      resetAFKTimer()
    }

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity)
    })

    // Initialize timer
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetAFKTimer()

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-gray-900">
            Job<span className="text-[#0057B8]">Linked</span>
          </Link>
          <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-[#0057B8]">
            ADMIN
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
          aria-label="Toggle navigation"
        >
          <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 transition-transform duration-200 md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          }`}
      >
        <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="text-[15px] font-semibold tracking-tight text-gray-900">
              Job<span className="text-[#0057B8]">Linked</span>
            </Link>
            <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-[#0057B8]">
              ADMIN
            </span>
          </div>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-gray-500 hover:text-gray-900"
            >
              ✕
            </button>
          )}
        </div>

        <div className="px-6 pt-5 pb-3">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#0057B8]">PESO · SANTA MARIA</p>
          <p className="mt-0.5 text-xs text-gray-400">Super Administrator</p>
        </div>

        <nav className="flex-1 py-3 px-4 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${isActive
                  ? 'bg-primary/10 text-primary border border-primary/25 shadow-[0_2px_12px_rgba(0,117,162,0.15)]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <Link
            to="/"
            className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <span>Public Site</span>
            <span className="text-gray-300 text-[10px]">↗</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3.5 py-2 rounded-xl text-xs text-danger hover:bg-danger/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-full overflow-x-hidden min-h-[calc(100vh-56px)] md:min-h-screen">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* AFK Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-primary/30 rounded-lg p-8 max-w-sm w-full shadow-xl animate-fade-in-scale">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Session Timeout Warning</h2>
            <p className="text-sm text-gray-600 mb-6">
              You have been inactive for 4 minutes. In 1 minute, you will be automatically logged out for security reasons.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarning(false)
                  resetAFKTimer()
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdminLayout
