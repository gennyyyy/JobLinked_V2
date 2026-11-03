import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Check, Users } from 'lucide-react'
import PublicShell from '@/shared/components/PublicShell'
import { LinkButton, Notice } from '@/shared/components/design'

const journeys = [
  {
    icon: Users,
    title: 'I’m looking for work',
    desc: 'Find opportunities that fit your skills and your life.',
    items: [
      'Discover verified local vacancies',
      'Create one organized profile',
      'Apply and track every update',
    ],
    href: '/register/job-seeker',
    label: 'Join as a job seeker',
  },
  {
    icon: Building2,
    title: 'I’m building a team',
    desc: 'Connect with motivated talent in your community.',
    items: [
      'Register and submit accreditation',
      'Post jobs after PESO approval',
      'Manage candidates in one place',
    ],
    href: '/register/employer',
    label: 'Join as an employer',
  },
]

export default function Register() {
  return (
    <PublicShell>
      <div className="bg-muted/60">
        <div className="page-container py-14">
          <div className="mx-auto max-w-3xl">
            <div className="mb-9 text-center">
              <p className="eyebrow mb-3">A place for your next chapter</p>
              <h1 className="text-4xl font-semibold tracking-[-.045em]">How can we help you grow?</h1>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">Choose the journey that feels right for you.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {journeys.map(({ icon: Icon, title, desc, items, href, label }) => (
                <div className="surface flex flex-col p-7" key={href}>
                  <span className="soft-icon">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-6 text-xl font-semibold">{title}</h2>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">{desc}</p>
                  <ul className="my-7 flex flex-col gap-3">
                    {items.map((item) => (
                      <li key={item} className="flex gap-2 text-xs text-muted-foreground">
                        <Check className="size-4 shrink-0 text-teal" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <LinkButton href={href} className="mt-auto">
                    {label}
                    <ArrowRight className="size-4" />
                  </LinkButton>
                </div>
              ))}
            </div>
            <div className="mt-7">
              <Notice title="PESO administrator access is provisioned">
                There is no public administrator registration. Authorized personnel receive access from the
                responsible organization.
              </Notice>
            </div>
            <p className="mt-7 text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/portals" className="font-medium text-primary">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
