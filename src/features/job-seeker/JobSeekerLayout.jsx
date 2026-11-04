import TopNavLayout from '@/shared/components/TopNavLayout'
import HelpChat from './HelpChat'

export default function JobSeekerLayout() {
  return (
    <>
      <TopNavLayout
        role="job-seeker"
        profileTo="/job-seeker/profile"
        roleLabel="Job Seeker"
        homeTo="/job-seeker"
      />
      <HelpChat />
    </>
  )
}
