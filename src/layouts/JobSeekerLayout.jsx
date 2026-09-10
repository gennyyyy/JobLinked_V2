import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const navItems = [
  { to: '/job-seeker', label: 'Browse Jobs', end: true },
  { to: '/job-seeker/applications', label: 'My Applications' },
  { to: '/job-seeker/profile', label: 'Profile' },
]

function JobSeekerLayout() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#272727] text-slate-100 flex flex-col font-sans">
      <header className="sticky top-0 z-30 bg-[#272727]/85 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/job-seeker" className="text-[15px] font-semibold tracking-tight text-white">
              Job<span className="text-[#0075A2]">Linked</span>
            </Link>
            <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#0075A2]">
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
                      ? 'bg-[#0075A2]/15 text-[#0075A2] border border-[#0075A2]/30'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <span className="text-xs text-white/40 truncate max-w-[180px]">
              {user?.name || user?.email || 'Job Seeker'}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-white/50 hover:text-rose-400 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.05] border border-white/[0.08]"
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
          <div className="md:hidden px-6 py-4 border-t border-white/[0.06] bg-[#272727] space-y-2">
            <div className="pb-2 border-b border-white/[0.06]">
              <p className="text-xs font-medium text-white">{user?.name || 'Job Seeker'}</p>
              <p className="text-[11px] text-white/40">{user?.email}</p>
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
                      ? 'bg-[#0075A2]/15 text-[#0075A2] border border-[#0075A2]/30'
                      : 'text-white/70 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:text-rose-300"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.06] bg-[#060608] text-white/30 mt-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">
            Job<span className="text-[#0075A2]">Linked</span> <span className="text-white/40">PESO</span>
          </span>
          <span>Municipal Hall, Poblacion · Santa Maria, Bulacan</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  )
}

export default JobSeekerLayout
