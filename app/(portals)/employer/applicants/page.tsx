import { EmployerApplicants } from "@/components/employer/applicants";

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job } = await searchParams;
  return <EmployerApplicants initialJob={job} />;
}
