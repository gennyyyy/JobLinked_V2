import { useEffect } from 'react'

// One static title per route. Everything else (portal pages, job detail) falls
// back to the bare brand or sets its own title after loading.
const TITLES = {
  '/': 'JobLinked — Local jobs in Santa Maria, Bulacan',
  '/jobs': 'Find local jobs — JobLinked',
  '/login': 'Sign in — JobLinked',
  '/signup': 'Create an account — JobLinked',
  '/signup/jobseeker': 'Job seeker sign up — JobLinked',
  '/signup/employer': 'Employer sign up — JobLinked',
  '/register': 'Create an account — JobLinked',
  '/register/job-seeker': 'Job seeker sign up — JobLinked',
  '/register/employer': 'Employer sign up — JobLinked',
  '/forgot-password': 'Reset your password — JobLinked',
  '/reset-password': 'Choose a new password — JobLinked',
  '/privacy': 'Privacy notice — JobLinked',
  '/terms': 'Terms of use — JobLinked',
  '/about': 'About JobLinked',
  '/peso-services': 'PESO services — JobLinked',
  '/faq': 'Frequently asked questions — JobLinked',
  '/how-it-works': 'How JobLinked works — JobLinked',
  '/accept-invite': 'Accept invitation — JobLinked',
  '/employer/status': 'Accreditation status — JobLinked',
}

export default function usePageTitle(pathname) {
  useEffect(() => {
    document.title = TITLES[pathname] || 'JobLinked'
  }, [pathname])
}
