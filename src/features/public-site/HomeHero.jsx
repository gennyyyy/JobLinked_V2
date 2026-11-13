'use client';
import { Link, useNavigate } from "react-router-dom";
import { useState } from 'react';
import { ArrowRight, MapPin, Search, ShieldCheck, Handshake, BriefcaseBusiness, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LinkButton, CompanyMark } from '../../shared/components/design';
import { SANTA_MARIA_BARANGAYS as BARANGAYS } from '../../shared/constants';
import teamImage from '../../assets/team.png';
import landingBg from '../../assets/hero-bg.jpg';

const ASSURANCES = [
    { icon: ShieldCheck, title: 'Verified local employers', copy: 'Opportunities from reviewed businesses.' },
    { icon: FileCheck2, title: 'Every application, in one place', copy: 'Stay informed, from applied to hired.' },
    { icon: Handshake, title: 'Connected with PESO', copy: 'Designed for coordinated local support.' },
];

export function HomeHero() {
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState('');
    const [barangay, setBarangay] = useState('');
    // DuckDuckGo can inject data-ddg-inputtype before hydration; tolerate it only on these two search controls.
    return (
      <>
        <section
          className="relative overflow-hidden bg-background bg-cover bg-center pb-10 pt-12 sm:pt-14 lg:pt-[58px]"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(247,250,255,0.93) 0%, rgba(247,250,255,0.76) 42%, rgba(247,250,255,0.12) 100%), url(${landingBg})` }}
        >
          <div className="parallax-bg" aria-hidden="true" />
          <div className="page-container relative">
            <div className="grid items-center gap-9 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
              <div className="hero-enter relative pb-4">
                <h1 className="max-w-[620px] text-[36px] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-[52px] lg:text-[58px]">
                  Connecting Local<br className="hidden sm:block" /> Talent with<br className="hidden sm:block" />{' '}
                  <span className="text-primary">Local Opportunities.</span>
                </h1>
                <p className="mt-5 max-w-[470px] text-[15px] leading-7 text-muted-foreground">
                  Discover verified job opportunities, track your applications, and connect with employers in Santa Maria, Bulacan—all in one platform.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <LinkButton href="/jobs" className="gap-3 px-6">
                    Find your next job<ArrowRight aria-hidden="true" className="size-4" />
                  </LinkButton>
                  <LinkButton href="/register/employer" variant="outline" className="gap-2 px-5">
                    <BriefcaseBusiness aria-hidden="true" className="size-4" />Post a job
                  </LinkButton>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-3.5 text-teal" />
                  <span>Built for the people of Santa Maria, Bulacan.</span>
                </div>
              </div>
              <div className="hero-enter relative mx-auto hidden h-[410px] w-full max-w-[490px] sm:block lg:h-[425px]" style={{ animationDelay: '100ms' }}>
                <div className="absolute -inset-x-[74px] bottom-0 aspect-[1510/1024]">
                  <Link to="/jobs" className="hero-float absolute bottom-[64px] left-0 z-10 w-[250px] rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-center gap-3">
                      <CompanyMark initials="N" />
                      <div>
                        <p className="text-xs text-muted-foreground">A new opportunity for you</p>
                        <p className="mt-1 text-sm font-semibold text-navy">Administrative Assistant</p>
                        <p className="mt-1 text-xs text-muted-foreground">Northfield Business Solutions</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Poblacion · Full-time</span>
                      <span className="text-xs font-semibold text-primary">₱18k – ₱22k</span>
                    </div>
                  </Link>
                  <div className="absolute inset-0">
                    <img
                      src={teamImage}
                      alt="Three young professionals wearing formal business attire"
                      width={1200}
                      height={800}
                      decoding="async"
                      sizes="(max-width: 1024px) 530px, 45vw"
                      className="absolute inset-0 h-full w-full object-contain object-bottom"
                      style={{ maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <form
              aria-label="Search local jobs"
              className="relative mt-10 flex flex-col gap-2 rounded-md border border-border bg-card p-2 sm:flex-row sm:items-center sm:gap-0"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/jobs?${new URLSearchParams({ keyword, location: barangay })}`);
              }}
            >
              <div className="flex flex-1 items-center gap-2.5 rounded-md px-4 focus-within:ring-2 focus-within:ring-primary">
                <Search aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <label htmlFor="home-keyword" className="sr-only">Job title, keyword, or company</label>
                <input
                  id="home-keyword"
                  type="text"
                  suppressHydrationWarning
                  placeholder="Job title, keyword, or company"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-11 w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="my-2 hidden h-8 w-px bg-border sm:block" />
              <div className="flex items-center gap-2.5 rounded-md px-4 focus-within:ring-2 focus-within:ring-primary sm:w-[260px]">
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <label htmlFor="home-barangay" className="sr-only">Choose a barangay</label>
                <select
                  id="home-barangay"
                  suppressHydrationWarning
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  className="h-11 w-full border-0 bg-transparent text-sm text-muted-foreground outline-none"
                >
                  <option value="">All barangays, Santa Maria</option>
                  {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <Button type="submit" className="min-h-11 gap-2 px-6">
                <Search aria-hidden="true" />Search jobs
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Popular searches:</span>
              {['Administrative', 'Sales', 'Production', 'No experience'].map((q) => (
                <Link
                  to={`/jobs?keyword=${encodeURIComponent(q)}`}
                  className="inline-flex min-h-8 items-center text-navy underline decoration-border underline-offset-4 hover:decoration-primary"
                  key={q}
                >
                  {q}
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section aria-label="Platform assurances" className="border-y border-border bg-card">
          <div className="page-container grid divide-y divide-border py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {ASSURANCES.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="flex items-start gap-3 py-4 sm:px-6 sm:first:pl-0 sm:last:pr-0">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal" strokeWidth={1.75} />
                <div>
                  <p className="text-sm font-semibold text-navy">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </>
    );
}
