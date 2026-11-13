import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'

const AUDIENCES = [
  {
    title: 'For job seekers',
    description: 'Your skills deserve the right opportunity.',
    items: ['Local jobs, verified employers', 'One profile, organized applications', 'Clear updates at every stage'],
    linkLabel: 'Find your opportunity',
    href: '/signup/jobseeker',
  },
  {
    title: 'For local employers',
    description: 'Great teams start with local talent.',
    items: ['Reach candidates in your community', 'Simplified accreditation workflow', 'Manage recruitment in one place'],
    linkLabel: 'Build your team',
    href: '/signup/employer',
  },
  {
    title: 'For PESO personnel',
    description: 'More connections. Better coordination.',
    items: ['Centralized employer accreditation', 'Vacancy and placement monitoring', 'Community-focused reporting'],
    linkLabel: 'Explore the PESO portal',
    href: '/super-admin',
  },
]

export function AudienceCards({ headingTag: Heading = 'h3' }) {
  return (
    <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
      {AUDIENCES.map(({ title, description, items, linkLabel, href }) => (
        <article className="flex flex-col border-t border-border pt-6" key={title}>
          <Heading className="text-lg font-semibold">{title}</Heading>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {items.map((item) => (
              <li className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" key={item}>
                <Check aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-teal" />
                {item}
              </li>
            ))}
          </ul>
          <Link className="text-link mt-auto pt-6 text-sm" to={href}>
            {linkLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </article>
      ))}
    </div>
  )
}
