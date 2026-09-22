import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import useAFKTimer from '../hooks/useAFKTimer'

const navItems = [
  { to: '/job-seeker', label: 'Browse Jobs', end: true },
  { to: '/job-seeker/applications', label: 'My Applications' },
  { to: '/job-seeker/profile', label: 'Profile' },
]

function JobSeekerLayout() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const { setWarningCallback } = useAFKTimer()

  useEffect(() => {
    setWarningCallback(() => setShowWarning(true))
  }, [setWarningCallback])

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-gray-200">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/job-seeker" className="text-[15px] font-semibold tracking-tight text-gray-900">
              Job<span className="text-[#0057B8]">Linked</span>
            </Link>
            <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary">
              SEEKER
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/25'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <span className="text-xs text-gray-400 truncate max-w-[180px]">
              {user?.name || user?.email || 'Job Seeker'}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-danger transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
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
        </div>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <div className="md:hidden px-6 py-4 border-t border-gray-200 bg-white space-y-2">
            <div className="pb-2 border-b border-gray-200">
              <p className="text-xs font-medium text-gray-900">{user?.name || 'Job Seeker'}</p>
              <p className="text-[11px] text-gray-400">{user?.email}</p>
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/25'
                      : 'text-gray-600 hover:text-gray-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3.5 py-2 text-xs text-danger hover:text-danger"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.06] bg-dark-blue text-white/30 mt-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">
            Job<span className="text-primary">Linked</span> <span className="text-white/40">PESO</span>
          </span>
          <span>Municipal Hall, Poblacion · Santa Maria, Bulacan</span>
          <span>© 2026</span>
        </div>
      </footer>

      {/* AFK Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Session Expiring</h3>
            <p className="text-sm text-gray-500 mb-6">
              You will be logged out in 1 minute due to inactivity. Move your mouse or press a key to stay signed in.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-[#004a9e] rounded-lg transition-colors"
              >
                Stay Signed In
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobSeekerLayout
