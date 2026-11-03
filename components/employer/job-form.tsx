"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  PageHeading,
  Panel,
  TextField,
  SelectField,
  Notice,
  EmptyState,
} from "@/components/shared";
import { EmployerRestriction } from "./dashboard";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { BARANGAYS, CATEGORIES, JOB_TYPES } from "@/constants";
import type { JobPosting } from "@/types";

const experiences = ["No experience", "Entry level", "1–3 years", "3+ years"];
const schema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, "Use a descriptive job title (5+ characters).")
      .max(120),
    category: z.enum(CATEGORIES as [string, ...string[]]),
    type: z.enum(JOB_TYPES as [string, ...string[]]),
    arrangement: z.enum(["On-site", "Hybrid", "Remote"]),
    barangay: z.enum(BARANGAYS as [string, ...string[]]),
    experience: z.enum(experiences as [string, ...string[]]),
    salaryMin: z
      .string()
      .refine(
        (v) => !v || (Number(v) > 0 && Number(v) <= 1000000),
        "Enter a positive amount up to ₱1,000,000.",
      ),
    salaryMax: z
      .string()
      .refine(
        (v) => !v || (Number(v) > 0 && Number(v) <= 1000000),
        "Enter a positive amount up to ₱1,000,000.",
      ),
    openings: z
      .number()
      .int("Use a whole number.")
      .min(1, "At least one opening is required.")
      .max(1000),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an application deadline."),
    description: z
      .string()
      .trim()
      .min(40, "Add a useful description of at least 40 characters.")
      .max(5000),
    qualifications: z
      .string()
      .trim()
      .min(10, "List the qualifications candidates need.")
      .max(3000),
    responsibilities: z
      .string()
      .trim()
      .min(10, "List the responsibilities for this role.")
      .max(3000),
    skills: z
      .string()
      .trim()
      .min(2, "Add at least one relevant skill.")
      .max(500),
    benefits: z.string().max(2000),
  })
  .refine((v) => !v.salaryMax || !!v.salaryMin, {
    path: ["salaryMin"],
    message: "Add a minimum salary, or leave both salary fields blank.",
  })
  .refine(
    (v) =>
      !v.salaryMin ||
      !v.salaryMax ||
      Number(v.salaryMax) >= Number(v.salaryMin),
    {
      path: ["salaryMax"],
      message: "Maximum salary cannot be less than the minimum.",
    },
  );
type Values = z.infer<typeof schema>;
const lines = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

export function EmployerJobForm({ id }: { id?: string }) {
  const { state, employer } = useDemo();
  if (!employer) return null;
  const job = id
    ? state.jobs.find((j) => j.id === id && j.employerId === employer.id)
    : undefined;
  if (id && (!job || ["Removed", "Flagged"].includes(job.status)))
    return (
      <EmptyState
        title="This vacancy cannot be edited."
        description="You can only edit your own vacancies. Flagged or removed postings need PESO clearance."
        href="/employer/jobs"
        label="Back to job management"
      />
    );
  return <VacancyForm key={id ?? employer.id} job={job} />;
}

function VacancyForm({ job }: { job?: JobPosting }) {
  const { employer, api } = useDemo();
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: job?.title ?? "",
      category: job?.category ?? CATEGORIES[0],
      type: job?.type ?? "Full-time",
      arrangement: (job?.arrangement as Values["arrangement"]) ?? "On-site",
      barangay: job?.barangay ?? employer?.barangay ?? "Poblacion",
      experience: job?.experience ?? "Entry level",
      salaryMin: job?.salaryMin?.toString() ?? "",
      salaryMax: job?.salaryMax?.toString() ?? "",
      openings: job?.openings ?? 1,
      deadline: job?.deadline.slice(0, 10) ?? "",
      description: job?.description ?? "",
      qualifications: job?.qualifications.join("\n") ?? "",
      responsibilities: job?.responsibilities.join("\n") ?? "",
      skills: job?.skills.join(", ") ?? "",
      benefits: job?.benefits.join("\n") ?? "",
    },
  });
  const errors = form.formState.errors;
  const submit = (values: Values, status: JobPosting["status"]) =>
    run(async () => {
      if (
        status === "Published" &&
        new Date(`${values.deadline}T23:59:59+08:00`).getTime() < Date.now()
      ) {
        form.setError("deadline", {
          message: "Choose a future deadline before publishing.",
        });
        return;
      }
      const input = {
        ...values,
        status,
        salaryMin: values.salaryMin ? Number(values.salaryMin) : null,
        salaryMax: values.salaryMax ? Number(values.salaryMax) : null,
        qualifications: lines(values.qualifications),
        responsibilities: lines(values.responsibilities),
        benefits: lines(values.benefits),
        skills: [
          ...new Set(
            values.skills
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          ),
        ],
      };
      if (job) await api.updateJob(job.id, input);
      else await api.createJob(input);
      toast.success(
        status === "Published"
          ? "vacancy published. It is now visible in Browse Jobs."
          : status === "Draft"
            ? "vacancy saved as a draft."
            : "vacancy changes saved.",
      );
      router.push("/employer/jobs");
    });
  const approved = employer?.accreditationStatus === "Approved";
  return (
    <>
      <Link className="text-link mb-5 text-xs" href="/employer/jobs">
        <ArrowLeft className="size-3.5" />
        Back to job management
      </Link>
      <PageHeading
        eyebrow="Open a door for someone"
        title={
          job
            ? "Make your opportunity even clearer."
            : "Find the next person for your team."
        }
        description="Clear details help local candidates decide whether this role is right for them."
      />
      <EmployerRestriction />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          submit(values, job?.status === "Closed" ? "Closed" : "Published"),
        )}
        className="flex max-w-4xl flex-col gap-6"
      >
        <Panel
          title="The basics"
          description="Everything a candidate needs to recognize the right opportunity."
        >
          <FieldGroup>
            <TextField
              label="Job title"
              required
              {...form.register("title")}
              error={errors.title?.message}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Job category"
                options={CATEGORIES}
                {...form.register("category")}
                error={errors.category?.message}
              />
              <SelectField
                label="Employment type"
                options={JOB_TYPES}
                {...form.register("type")}
                error={errors.type?.message}
              />
              <SelectField
                label="Workplace arrangement"
                options={["On-site", "Hybrid", "Remote"]}
                {...form.register("arrangement")}
                error={errors.arrangement?.message}
              />
              <SelectField
                label="Work barangay"
                options={BARANGAYS}
                {...form.register("barangay")}
                error={errors.barangay?.message}
              />
              <SelectField
                label="Experience level"
                options={experiences}
                {...form.register("experience")}
                error={errors.experience?.message}
              />
              <TextField
                label="Number of openings"
                type="number"
                min={1}
                max={1000}
                required
                {...form.register("openings", { valueAsNumber: true })}
                error={errors.openings?.message}
              />
            </div>
          </FieldGroup>
        </Panel>
        <Panel
          title="Pay & application deadline"
          description="Salary is optional. Amounts are monthly, in Philippine pesos."
        >
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Minimum monthly salary (optional)"
                type="number"
                min={1}
                {...form.register("salaryMin")}
                error={errors.salaryMin?.message}
              />
              <TextField
                label="Maximum monthly salary (optional)"
                type="number"
                min={1}
                {...form.register("salaryMax")}
                error={errors.salaryMax?.message}
              />
            </div>
            <TextField
              label="Application deadline"
              type="date"
              required
              {...form.register("deadline")}
              error={errors.deadline?.message}
            />
          </FieldGroup>
        </Panel>
        <Panel title="Tell candidates about the role">
          <FieldGroup>
            <TextField
              label="Job description"
              multiline
              rows={5}
              required
              {...form.register("description")}
              error={errors.description?.message}
            />
            <TextField
              label="Qualifications"
              multiline
              rows={4}
              required
              help="One qualification per line. Keep requirements relevant to the role."
              {...form.register("qualifications")}
              error={errors.qualifications?.message}
            />
            <TextField
              label="Responsibilities"
              multiline
              rows={4}
              required
              help="One responsibility per line."
              {...form.register("responsibilities")}
              error={errors.responsibilities?.message}
            />
            <TextField
              label="Required skills"
              required
              help="Separate skills with commas. These support transparent keyword matching."
              {...form.register("skills")}
              error={errors.skills?.message}
            />
            <TextField
              label="Benefits (optional)"
              multiline
              rows={3}
              help="One benefit per line."
              {...form.register("benefits")}
              error={errors.benefits?.message}
            />
          </FieldGroup>
        </Panel>
        <Notice title="publication only">
          Publishing updates this browser’s connected . No vacancy is sent
          to Facebook, email, SMS, or a government system.
        </Notice>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            onClick={form.handleSubmit((values) => submit(values, "Draft"))}
          >
            <Save data-icon="inline-start" />
            Save as draft
          </Button>
          <Button
            type="submit"
            disabled={pending || (!approved && job?.status !== "Closed")}
          >
            <Send data-icon="inline-start" />
            {pending
              ? "Saving…"
              : job?.status === "Closed"
                ? "Save closed vacancy"
                : job?.status === "Published"
                  ? "Save published vacancy"
                  : "Publish vacancy"}
          </Button>
        </div>
      </form>
    </>
  );
}
