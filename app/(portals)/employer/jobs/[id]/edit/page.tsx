import { EmployerJobForm } from "@/components/employer/job-form";

export default async function EditVacancyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployerJobForm id={id} />;
}
