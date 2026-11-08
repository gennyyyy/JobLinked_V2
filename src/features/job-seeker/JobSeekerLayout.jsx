import TopNavLayout from '@/shared/components/TopNavLayout'

export default function JobSeekerLayout() {
  return (
    <TopNavLayout
      role="job-seeker"
      profileTo="/job-seeker/profile"
      roleLabel="Job Seeker"
      homeTo="/job-seeker"
    />
  )
}
