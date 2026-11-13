import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MapPin, Menu, ArrowRight, ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Logo, LinkButton } from "./design";
import { cn } from "@/lib/utils";
import useAuth from "../hooks/useAuth";

const links = [['Home', '/'], ['Find Jobs', '/jobs'], ['How It Works', '/how-it-works'], ['PESO Services', '/peso-services'], ['About', '/about'], ['FAQ', '/faq']];

export function PublicShell({ children }) {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const auth = useAuth();
  const user = auth?.user;
  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-navy text-white">
        <div className="page-container flex min-h-8 items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[10px] tracking-wide">
            <MapPin className="size-3" />Santa Maria, Bulacan
            <span className="mx-2 hidden opacity-35 sm:inline">|</span>
            <span className="hidden text-white/70 sm:inline">Opportunities closer to home.</span>
          </span>
        </div>
      </div>
      <header className="relative z-30 border-b border-border/70 bg-white">
        <div className="page-container flex h-[78px] items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
            {links.map(([label, href]) => (
              <Link key={href} to={href} className={cn('nav-link relative', pathname === href && 'text-primary after:absolute after:inset-x-0 after:-bottom-[17px] after:h-0.5 after:rounded-full after:bg-primary')} aria-current={pathname === href ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {user ? (
              <LinkButton href={`/${user.role}`} variant="outline" className="hidden sm:inline-flex">
                My dashboard<ArrowUpRight className="size-4" />
              </LinkButton>
            ) : (
              <>
                <Link to="/login" className="nav-link hidden text-navy sm:inline-flex">Log in</Link>
                <LinkButton href="/signup" className="hidden sm:inline-flex">Sign up<ArrowRight className="size-3.5" /></LinkButton>
              </>
            )}
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMenu(true)}>
              <Menu />
            </Button>
          </div>
        </div>
      </header>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Explore JobLinked</SheetTitle>
            <SheetDescription>Your local opportunity starts here.</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-2 px-6" aria-label="Mobile navigation">
            {links.map(([label, href]) => (
              <Link to={href} key={href} onClick={() => setMenu(false)} className="nav-link">{label}</Link>
            ))}
            <Separator />
            <Link to="/login" onClick={() => setMenu(false)} className="nav-link">Log in</Link>
            <LinkButton href="/signup">Create an account</LinkButton>
          </nav>
        </SheetContent>
      </Sheet>
      <main id="main-content" className="flex-1">{children}</main>
      <footer className="border-t bg-white pt-8">
        <div className="page-container">
          <div className="grid gap-6 pb-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-3 max-w-[270px] text-xs leading-6 text-muted-foreground">Connecting local talent with meaningful opportunities in Santa Maria, Bulacan.</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-navy"><MapPin className="size-3.5 text-teal" />Made for our community.</p>
            </div>
            {[
              { title: 'For job seekers', items: [['Browse jobs', '/jobs'], ['Create an account', '/register/job-seeker'], ['Application tracking', '/job-seeker/applications'], ['Career resources', '/#peso-services']] },
              { title: 'For employers', items: [['Post a job', '/register/employer'], ['Employer registration', '/register'], ['Accreditation process', '/#how-it-works'], ['Employer portal', '/login']] },
              { title: 'JobLinked', items: [['About the platform', '/#about'], ['PESO services', '/#peso-services'], ['Frequently asked questions', '/#faq']] },
            ].map(group => (
              <div key={group.title}>
                <h3 className="mb-2 text-xs font-semibold">{group.title}</h3>
                <ul className="flex flex-col gap-0">
                  {group.items.map(([label, href]) => (
                    <li key={href}><Link to={href} className="inline-flex min-h-6 items-center text-xs text-muted-foreground transition-colors hover:text-primary">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-between gap-2 py-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} JobLinked. Built with community in mind.</p>
            <div className="flex items-center gap-3">
              <Link className="min-h-6 content-center hover:text-primary" to="/privacy">Privacy notice</Link>
              <Link className="min-h-6 content-center hover:text-primary" to="/terms">Terms of Use</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default PublicShell;

