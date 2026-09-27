import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import useAFKTimer from '../hooks/useAFKTimer'
import TextBasedLogo from '../assets/TextBased Logo.png'
import SidebarAccount from '../components/SidebarAccount'
import NotificationBell from '../components/NotificationBell'

const navItems = [
  { to: '/job-seeker', label: 'Dashboard', end: true },
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
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-gray-50 text-gray-900 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Link to="/job-seeker">
            <img src={TextBasedLogo} alt="JobLinked" className="h-6" />
          </Link>
          <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary">
            SEEKER
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 cursor-pointer"
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
      </header>

      {/* Sidebar Navigation */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 h-screen md:h-screen md:sticky md:top-0 bg-primary border-r border-primary/20 flex flex-col shrink-0 transition-transform duration-200 md:translate-x-0 ${
            mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          }`}
        >
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-dark-blue">
          <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
            <Link to="/job-seeker">
              <img src={TextBasedLogo} alt="JobLinked" className="h-5 w-auto object-contain" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-accent rounded-full border border-accent/25 px-2 py-0.5 flex items-center h-6">
              SEEKER
            </span>
            {mobileOpen && (
              <button
                onClick={() => setMobileOpen(false)}
                className="md:hidden text-gray-500 hover:text-gray-900"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="px-6 pt-5 pb-3">
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/50">PESO · SANTA MARIA</p>
          <p className="mt-0.5 text-xs text-white/50 truncate font-medium">{user?.name || 'Job Seeker'}</p>
        </div>

        <nav className="flex-1 py-3 px-4 space-y-1.5 overflow-y-auto min-h-0">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${isActive
                  ? 'bg-white/20 text-white border border-white/20 shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <SidebarAccount
          user={user}
          profileTo="/job-seeker/profile"
          roleLabel="Job Seeker"
          onNavigate={() => setMobileOpen(false)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-full overflow-x-hidden md:h-screen md:overflow-y-auto min-h-[calc(100vh-56px)]">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* AFK Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Session Expiring</h3>
            <p className="text-sm text-gray-500 mb-6">
              You will be logged out in 1 minute due to inactivity. Move your mouse or press a key to stay signed in.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg active:scale-[0.98] transition-colors"
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
