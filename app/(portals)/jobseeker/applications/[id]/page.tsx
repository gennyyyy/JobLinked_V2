import { JobSeekerApplicationDetail } from "@/components/jobseeker/applications";

export default async function MyApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobSeekerApplicationDetail id={id} />;
}
