import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileCheck2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import SkipLink from './SkipLink'
import NotificationBell from './NotificationBell'
import useAuth from '../hooks/useAuth'
import useAFKTimer from '../hooks/useAFKTimer'
import useDialog from '../hooks/useDialog'
import { initialsOf } from '../utils/accountName'
import { cn } from '@/lib/utils'

const ICONS = {
  dashboard: LayoutDashboard,
  'browse jobs': BriefcaseBusiness,
  'job posts': BriefcaseBusiness,
  'my applications': ClipboardList,
  applications: ClipboardList,
  employment: FileCheck2,
  notifications: Bell,
  accreditation: ShieldCheck,
  applicants: Users,
  employees: Users,
  company: Building2,
  profile: UserRound,
  users: Users,
  roles: UserCog,
  reports: BarChart3,
  logs: ScrollText,
  settings: Settings,
  broadcast: Megaphone,
}

function iconFor(label) {
  return ICONS[String(label || '').toLowerCase()] || LayoutDashboard
}

function flattenItems(items) {
  return items.flatMap((item) => (item.children ? [{ label: item.label, group: true }, ...item.children] : [item]))
}

export default function TopNavLayout({ navItems = [], profileTo, roleLabel, homeTo, fixedContent = false, badge, subhead }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const home = homeTo ?? `/${pathname.split('/')[1] || ''}`
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showWarning, setShowWarning] = useState(false)
  const handleWarning = useCallback(() => setShowWarning(true), [])
  const afkRef = useDialog(() => setShowWarning(false), showWarning)
  useAFKTimer(true, handleWarning)

  function handleLogout() {
    logout()
    navigate('/')
  }

  const flat = flattenItems(navItems)
  const activeItem = flat.find((item) => !item.group && (pathname === item.to || pathname.startsWith(`${item.to}/`)))
  const pageLabel = activeItem?.label ?? 'Overview'
  const subheadText = typeof subhead === 'function' ? subhead(user) : subhead
  const displaySubhead = subheadText || user?.full_name || user?.name || user?.email || roleLabel || 'Workspace'
  const initials = initialsOf(user, displaySubhead)

  const sidebar = (small = false) => (
    <div className="flex h-full flex-col">
      <div className="flex h-[85px] items-center px-6">
        <Link to={home} className="flex items-center gap-2 font-semibold tracking-tight text-navy" aria-label="JobLinked home">
          {collapsed && !small ? (
            <span className="text-lg">J</span>
          ) : (
            <>
              <span className="text-[22px] font-bold tracking-[-1px]">Job<span className="text-primary">Linked</span><span className="text-primary">.</span></span>
            </>
          )}
        </Link>
      </div>
      <div className={cn('px-6 pb-4', collapsed && !small && 'px-4')}>
        <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
          {collapsed && !small ? (
            <ShieldCheck />
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-teal" />
              {badge || `${roleLabel || 'Portal'} workspace`}
            </>
          )}
        </Badge>
      </div>
      {(!collapsed || small) && displaySubhead && (
        <div className="px-6 pb-4">
          <p className="text-[10px] font-medium uppercase tracking-[.15em] text-muted-foreground">{roleLabel}</p>
          <p className="mt-1 truncate text-xs font-medium text-navy">{displaySubhead}</p>
        </div>
      )}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label={`${roleLabel || 'Portal'} navigation`}>
        {flat.map((item) => {
          if (item.group) {
            return (
              (!collapsed || small) && (
                <p key={item.label} className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                  {item.label}
                </p>
              )
            )
          }
          const Icon = iconFor(item.label)
          const active = pathname === item.to || (item.end ? pathname === item.to : pathname.startsWith(`${item.to}/`))
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobile(false)}
              title={collapsed && !small ? item.label : undefined}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-navy',
                active && 'bg-blue-soft font-medium text-primary',
                collapsed && !small && 'justify-center px-1',
              )}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={1.7} />
              {(!collapsed || small) && <span className="flex-1">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
      {(!collapsed || small) && (
        <div className="m-4 rounded-xl border border-primary/10 bg-blue-soft/60 p-4">
          <p className="text-xs font-semibold text-navy">Made for our community.</p>
          <p className="mt-2 text-[10px] leading-5 text-muted-foreground">One local connection can open a new chapter.</p>
          <Link to="/jobs" className="text-link mt-1 text-[10px]">
            Explore opportunities
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t p-4">
        <Link className="flex min-h-10 items-center gap-3 px-2 text-[11px] text-muted-foreground" to="/faq">
          <HelpCircle className="size-4" />
          {(!collapsed || small) && 'Help & resources'}
        </Link>
      </div>
    </div>
  )

  const lower = query.toLowerCase()
  const results = flat
    .filter((item) => !item.group && item.label.toLowerCase().includes(lower))
    .map((item) => ({ title: item.label, subtitle: 'Workspace page', href: item.to }))

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
      <div className={cn('min-h-screen transition-[margin]', collapsed ? 'lg:ml-[82px]' : 'lg:ml-[248px]', fixedContent && 'flex h-screen flex-col')}>
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
            <NotificationBell />
            <span className="hidden h-7 w-px bg-border sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" />}>
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left sm:block">
                  <span className="block text-[11px] font-medium text-navy">{displaySubhead}</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{roleLabel}</span>
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
        <main id="main-content" tabIndex={-1} className={cn('mx-auto w-full max-w-[1440px] p-5 sm:p-7 lg:p-8', fixedContent ? 'min-h-0 flex-1 overflow-hidden' : '')}>
          <div className="space-y-8">
            <Outlet />
          </div>
        </main>
        <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3 px-8 pb-6 text-[10px] text-muted-foreground">
          <span>JobLinked · Santa Maria, Bulacan</span>
          <div className="flex gap-4">
            <Link to="/privacy">Privacy Notice</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Find your way around.</DialogTitle>
            <DialogDescription>Search pages available in your workspace.</DialogDescription>
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
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div ref={afkRef} role="dialog" aria-modal="true" aria-labelledby="afk-title" className="mx-4 max-w-sm rounded-lg border border-primary bg-card p-5 shadow-xl">
            <h3 id="afk-title" className="mb-2 text-lg font-bold text-foreground">Session Expiring</h3>
            <p className="mb-6 text-sm text-muted-foreground">You will be logged out in 1 minute due to inactivity. Move your mouse or press a key to stay signed in.</p>
            <div className="flex gap-2">
              <Button onClick={handleLogout} className="flex-1 border border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sign Out</Button>
              <Button onClick={() => setShowWarning(false)} className="flex-1 bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90">Stay Signed In</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
