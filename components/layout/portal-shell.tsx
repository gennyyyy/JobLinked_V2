"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Search,
  Menu,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  ArrowUpRight,
  HelpCircle,
  Settings,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo, LinkButton, EmptyState } from "@/components/shared";
import { PublicShell } from "./public-shell";
import { DemoSwitcher } from "./demo-switcher";
import { PORTAL_NAV } from "@/constants/navigation";
import { ROLE_LABELS } from "@/constants";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { initials, isJobOpen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";
import { portalRole, canOpenSection } from "@/lib/permissions";

export function PortalShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { state, user, ready, employer, api } = useDemo();
  const pathname = usePathname();
  const router = useRouter();
  const { run } = useAction();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const profilePicture = role === "jobseeker" && user?.name === "Maria Santos"
    ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/402fe4473f1b29109259566ee004bf96-774447062-pEYH9kqDabuKqTKjgoXLd2RT4sQqWm.jpg"
    : undefined;
  if (!ready)
    return (
      <main id="main-content" className="min-h-screen bg-muted p-8">
        <Skeleton className="mb-7 h-12 w-60" />
        <div className="grid gap-5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="mt-8 h-96" />
      </main>
    );
  if (
    !user ||
    !user.active ||
    portalRole(user.role) !== role ||
    !canOpenSection(state, user, pathname.split("/")[2] || "dashboard")
  )
    return (
      <PublicShell>
        <div className="page-container py-16">
          <EmptyState
            title={
              !user
                ? "Your next chapter starts with a demo account."
                : user.role !== role
                  ? `This is the ${ROLE_LABELS[role]} portal.`
                  : "This demo account is suspended."
            }
            description="Role guards demonstrate the intended experience only. Production access must be enforced by the backend."
            action={
              <div className="flex flex-wrap items-center justify-center gap-5">
                <LinkButton
                  href={
                    user && user.active
                      ? `/${portalRole(user.role)}/dashboard`
                      : "/login"
                  }
                >
                  {user && user.active ? "Open my portal" : "Go to demo login"}
                </LinkButton>
                <DemoSwitcher compact />
              </div>
            }
          />
        </div>
      </PublicShell>
    );
  const navigation = PORTAL_NAV[role].filter((n) =>
    canOpenSection(state, user, n.path),
  );
  const activePath = pathname.split("/")[2] || "dashboard";
  const label =
    navigation.find((n) => n.path === activePath)?.label ?? "Workspace";
  const unread = state.notifications.filter(
    (n) => n.userId === user.id && !n.read,
  ).length;
  const pending = state.accreditations.filter(
    (a) => a.status === "Pending Review",
  ).length;
  const sidebar = (small = false) => (
    <div className="flex h-full flex-col">
      <div className="flex h-[85px] items-center px-6">
        <Logo compact={!small && collapsed} />
      </div>
      <div className={cn("px-6 pb-4", collapsed && !small && "px-4")}>
        <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
          {collapsed && !small ? (
            <ShieldCheck />
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-teal" />
              {ROLE_LABELS[user.role]} workspace
            </>
          )}
        </Badge>
      </div>
      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3"
        aria-label={`${ROLE_LABELS[role]} navigation`}
      >
        {navigation.map(({ label: title, path, icon: Icon }) => (
          <Link
            key={path}
            href={`/${role}/${path}`}
            onClick={() => setMobile(false)}
            title={collapsed && !small ? title : undefined}
            aria-label={title}
            aria-current={activePath === path ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-navy",
              activePath === path && "bg-blue-soft font-medium text-primary",
              collapsed && !small && "justify-center px-1",
            )}
          >
            <Icon className="size-[17px] shrink-0" strokeWidth={1.7} />
            {(!collapsed || small) && (
              <>
                <span className="flex-1">{title}</span>
                {path === "notifications" && unread > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-[9px] text-primary">
                    {unread}
                  </span>
                )}
                {role === "admin" &&
                  path === "accreditation" &&
                  pending > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-md bg-warning-soft text-[9px] text-warning">
                      {pending}
                    </span>
                  )}
              </>
            )}
          </Link>
        ))}
      </nav>
      {(!collapsed || small) && (
        <div className="m-4 rounded-xl border border-primary/10 bg-blue-soft/60 p-4">
          <p className="text-xs font-semibold text-navy">
            Made for our community.
          </p>
          <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
            One local connection can open a new chapter.
          </p>
          <Link href="/jobs" className="text-link mt-1 text-[10px]">
            Explore opportunities
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t p-4">
        <Link
          className="flex min-h-10 items-center gap-3 px-2 text-[11px] text-muted-foreground"
          href="/faq"
        >
          <HelpCircle className="size-4" />
          {(!collapsed || small) && "Help & resources"}
        </Link>
        <div
          className={cn(
            "px-2 text-muted-foreground",
            collapsed && !small && "hidden",
          )}
        >
          <DemoSwitcher compact />
        </div>
      </div>
    </div>
  );
  const lower = query.toLowerCase();
  const pageResults = navigation
    .filter((n) => n.label.toLowerCase().includes(lower))
    .map((n) => ({
      title: n.label,
      subtitle: "Workspace page",
      href: `/${role}/${n.path}`,
    }));
  const jobs = state.jobs
    .filter((j) =>
      role === "employer"
        ? j.employerId === employer?.id
        : role === "jobseeker"
          ? isJobOpen(j) &&
            state.employers.some(
              (e) =>
                e.id === j.employerId && e.accreditationStatus === "Approved",
            )
          : true,
    )
    .filter((j) => j.title.toLowerCase().includes(lower))
    .slice(0, 5)
    .map((j) => ({
      title: j.title,
      subtitle:
        state.employers.find((e) => e.id === j.employerId)?.name ??
        "Sample vacancy",
      href:
        role === "employer"
          ? `/employer/jobs/${j.id}/edit`
          : role === "admin"
            ? "/admin/jobs"
            : `/jobs/${j.id}`,
    }));
  const results = [...pageResults, ...jobs].slice(0, 9);
  return (
    <div data-demo-ready="true" className="min-h-screen bg-muted/70">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r bg-white transition-[width] lg:block",
          collapsed ? "w-[82px]" : "w-[248px]",
        )}
      >
        {sidebar()}
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[290px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
            <SheetDescription>
              Navigate your role-based workspace.
            </SheetDescription>
          </SheetHeader>
          {sidebar(true)}
        </SheetContent>
      </Sheet>
      <div
        className={cn(
          "portal-main min-h-screen transition-[margin]",
          collapsed ? "lg:ml-[82px]" : "lg:ml-[248px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between gap-3 border-b bg-white/95 px-5 backdrop-blur-sm lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open workspace navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <nav
              aria-label="Breadcrumb"
              className="hidden items-center gap-2 text-[11px] sm:flex"
            >
              <Link
                href={`/${role}/dashboard`}
                className="text-muted-foreground"
              >
                Workspace
              </Link>
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="truncate font-medium text-navy">{label}</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="mr-3 hidden min-h-10 w-[210px] items-center gap-2 rounded-lg border bg-muted/50 px-3 text-[11px] text-muted-foreground md:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-3.5" />
              Search your workspace…
            </button>
            <button
              className="flex size-11 items-center justify-center text-muted-foreground md:hidden"
              aria-label="Search workspace"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </button>
            <Link
              href={`/${role}/notifications`}
              aria-label={`Notifications, ${unread} unread`}
              className="relative flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute right-2.5 top-2 size-1.5 rounded-full bg-primary" />
              )}
            </Link>
            <span className="hidden h-7 w-px bg-border sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" className="gap-2 px-1.5" />}
              >
                <Avatar>
                  {profilePicture && <AvatarImage src={profilePicture} alt={`${user.name} profile picture`} />}
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left sm:block">
                  <span className="block text-[11px] font-medium text-navy">
                    {user.name}
                  </span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
                <ChevronDown className="hidden sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => router.push(`/${role}/settings`)}
                  >
                    <Settings />
                    Account settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/")}>
                    <ArrowUpRight />
                    Public website
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() =>
                      run(async () => {
                        await api.logout();
                        router.push("/");
                      })
                    }
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1440px] p-5 sm:p-7 lg:p-8"
        >
          <div className="space-y-8">
            {children}
          </div>
        </main>
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-8 pb-6 text-[10px] text-muted-foreground">
          <span>JobLinked · Santa Maria, Bulacan</span>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy Notice</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Find your way around.</DialogTitle>
            <DialogDescription>
              Search pages and vacancies available in your workspace.
            </DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupInput
              aria-label="Workspace search"
              placeholder="Search pages or vacancies…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-col gap-1">
            {results.length ? (
              results.map((result, i) => (
                <Link
                  key={`${result.href}-${i}`}
                  href={result.href}
                  onClick={() => setSearchOpen(false)}
                  className="flex min-h-16 items-center justify-between rounded-lg p-3 hover:bg-muted"
                >
                  <span>
                    <span className="block text-xs font-medium text-navy">
                      {result.title}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {result.subtitle}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 text-primary" />
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No matching pages or vacancies.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
