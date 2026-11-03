"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  PageHeading,
  Panel,
  TextField,
  SelectField,
  CompanyMark,
  StatusBadge,
} from "@/components/shared";
import { BARANGAYS } from "@/constants";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import type { Employer } from "@/types";

const companySchema = z.object({
  name: z.string().trim().min(3, "Provide a company name.").max(120),
  industry: z.string().trim().min(3, "Add your industry.").max(80),
  description: z
    .string()
    .trim()
    .min(30, "Tell candidates a little more (30+ characters).")
    .max(3000),
  email: z.email("Enter a valid contact email."),
  phone: z
    .string()
    .regex(
      /^(\+63|0)[\d\s-]{9,15}$/,
      "Enter a valid Philippine contact number.",
    ),
  barangay: z.enum(BARANGAYS as [string, ...string[]]),
  address: z
    .string()
    .trim()
    .min(5, "Enter the business address.")
    .max(250),
  website: z
    .string()
    .trim()
    .max(150)
    .refine(
      (v) =>
        !v ||
        /^((https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+\/?[a-z0-9/_-]*)$/i.test(v),
      "Use a domain or an https website URL.",
    ),
});
type CompanyValues = z.infer<typeof companySchema>;

export function CompanyProfile() {
  const { employer } = useDemo();
  return employer ? (
    <CompanyProfileForm key={employer.id} company={employer} />
  ) : null;
}

function CompanyProfileForm({ company }: { company: Employer }) {
  const { api } = useDemo();
  const { run, pending } = useAction();
  const form = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company.name,
      industry: company.industry,
      description: company.description,
      email: company.email,
      phone: company.phone,
      barangay: company.barangay,
      address: company.address,
      website: company.website,
    },
  });
  const errors = form.formState.errors;
  return (
    <>
      <PageHeading
        eyebrow="Let your company shine"
        title="A good team starts with your story."
        description="Help candidates understand who you are, what you do, and where they can find you."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            run(async () => {
              await api.updateCompany(values);
              form.reset(values);
            }, "company profile updated for this session."),
          )}
          className="flex min-w-0 flex-col gap-6"
        >
          <Panel
            title="Company details"
            description="These provided details appear alongside your public vacancies."
          >
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Company name"
                  required
                  {...form.register("name")}
                  error={errors.name?.message}
                />
                <TextField
                  label="Industry"
                  required
                  {...form.register("industry")}
                  error={errors.industry?.message}
                />
              </div>
              <TextField
                label="About the company"
                multiline
                rows={5}
                required
                {...form.register("description")}
                error={errors.description?.message}
              />
              <TextField
                label="Website (optional)"
                {...form.register("website")}
                error={errors.website?.message}
              />
            </FieldGroup>
          </Panel>
          <Panel title="Contact & location">
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Recruitment contact email"
                  type="email"
                  required
                  {...form.register("email")}
                  error={errors.email?.message}
                />
                <TextField
                  label="Business phone"
                  type="tel"
                  required
                  {...form.register("phone")}
                  error={errors.phone?.message}
                />
              </div>
              <SelectField
                label="Business barangay"
                options={BARANGAYS}
                {...form.register("barangay")}
                error={errors.barangay?.message}
              />
              <TextField
                label="Business address"
                required
                {...form.register("address")}
                error={errors.address?.message}
              />
            </FieldGroup>
          </Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Changes are session-only in this .
            </p>
            <Button type="submit" disabled={pending}>
              <Save data-icon="inline-start" />
              Save company profile
            </Button>
          </div>
        </form>
        <Panel title="Your company at a glance">
          <CompanyMark
            initials={company.initials}
            color={company.color}
            large
          />
          <h2 className="mt-4 text-base font-semibold">{company.name}</h2>
          <p className="my-3 text-xs leading-6 text-muted-foreground">
            {company.industry} · {company.barangay}
          </p>
          <StatusBadge status={company.accreditationStatus} />
          <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
            Authorized representative: {company.representative}. Company profile
            edits do not replace the accreditation review process.
          </p>
        </Panel>
      </div>
    </>
  );
}
