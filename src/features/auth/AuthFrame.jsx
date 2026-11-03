import { Building2, FileCheck2, MapPin, ShieldCheck, Users } from 'lucide-react'

export default function AuthFrame({ title, subtitle, children }) {
  return (
    <div className="bg-muted/60">
      <div className="page-container py-10 sm:py-14">
        <div className="mx-auto grid max-w-[1020px] overflow-hidden rounded-2xl border bg-white lg:grid-cols-[.85fr_1fr]">
          <aside className="relative hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
            <div>
              <span className="flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <Building2 className="size-6" />
              </span>
              <p className="mt-10 text-[10px] font-medium uppercase tracking-[.15em] text-white/55">
                Local talent. Local opportunities.
              </p>
              <h2 className="mt-4 text-[36px] font-semibold leading-tight tracking-[-.04em] text-white">
                Your next chapter
                <br />
                could start
                <br />
                close to home.
              </h2>
              <p className="mt-5 text-xs leading-7 text-white/65">
                A simpler way to find meaningful work, build great teams, and connect our community.
              </p>
              <div className="mt-9 flex flex-col gap-5">
                {[
                  [ShieldCheck, 'Verified local employers'],
                  [FileCheck2, 'Applications, organized'],
                  [Users, 'A community-first approach'],
                ].map(([Icon, text]) => (
                  <div key={text} className="flex items-center gap-3 text-xs text-white/85">
                    <Icon className="size-4 text-[#8edbd1]" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-14">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <MapPin className="size-3.5" />
                Santa Maria, Bulacan
              </div>
              <p className="mt-5 border-t border-white/15 pt-5 text-[10px] leading-6 text-white/50">
                Independent frontend prototype.
                <br />
                Not an official government service.
              </p>
            </div>
          </aside>
          <div className="p-6 sm:p-10">
            <h1 className="text-[29px] font-semibold tracking-[-.04em]">{title}</h1>
            <p className="mb-7 mt-2 text-xs leading-6 text-muted-foreground">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
