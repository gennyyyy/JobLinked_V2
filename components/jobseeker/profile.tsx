"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Save, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResumeAutofill } from "@/components/forms/resume-autofill";
import { ResumeManagement } from "@/components/jobseeker/resumes";
import { FieldGroup } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  PageHeading,
  Panel,
  TextField,
  SelectField,
  Notice,
} from "@/components/shared";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { BARANGAYS } from "@/constants";
import { profileCompletion } from "@/lib/format";
import type { JobSeeker } from "@/types";

const profileSchema = z.object({
  name: z.string().trim().min(3, "Enter your full name.").max(100),
  phone: z
    .string()
    .regex(
      /^(\+63|0)[\d\s-]{9,15}$/,
      "Enter a valid Philippine contact number.",
    ),
  headline: z
    .string()
    .trim()
    .min(5, "Add a short professional headline.")
    .max(150),
  barangay: z.enum(BARANGAYS as [string, ...string[]]),
  address: z.string().trim().min(5, "Enter your address.").max(250),
  education: z
    .string()
    .trim()
    .min(5, "Add your education or training.")
    .max(500),
  experience: z.string().max(2000),
  skills: z
    .string()
    .trim()
    .min(2, "Add at least one skill, separated by commas.")
    .max(500),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function JobSeekerProfile() {
  const { seeker } = useDemo();
  return seeker ? <ProfileForm key={seeker.id} profile={seeker} /> : null;
}

function TagField({
  label,
  value,
  onChange,
  placeholder,
  help,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help?: string;
  error?: string;
  required?: boolean;
}) {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const [draft, setDraft] = useState("");
  const addTag = () => {
    const tag = draft.trim();
    if (!tag || tags.includes(tag)) return setDraft("");
    onChange([...tags, tag].join(", "));
    setDraft("");
  };
  const removeTag = (tagToRemove: string) =>
    onChange(tags.filter((tag) => tag !== tagToRemove).join(", "));

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-0.5 hover:bg-primary/15" aria-label={`Remove ${tag}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder={tags.length ? "Add another…" : placeholder}
          className="min-w-[180px] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="button" onClick={addTag} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Add ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ProfileForm({ profile }: { profile: JobSeeker }) {
  const { api } = useDemo();
  const [profilePicture, setProfilePicture] = useState<string | null>(profile.profilePicture ?? null);
  const { run, pending } = useAction();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile.name,
      phone: profile.phone,
      headline: profile.headline,
      barangay: profile.barangay,
      address: profile.address,
      education: profile.education,
      experience: profile.experience,
      skills: profile.skills.join(", "),
    },
  });
  const errors = form.formState.errors;
  const submit = (values: ProfileValues) =>
    run(async () => {
      await api.updateProfile({
        ...values,
        skills: [
          ...new Set(
            values.skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ],
      });
      form.reset(values);
    }, "profile updated for this session.");
  return (
    <>
      <PageHeading
        eyebrow="Introduce yourself"
        title="Your story, your next step."
        description="Give local employers a clear picture of your experience and the skills you bring."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex min-w-0 flex-col gap-6"
          noValidate
        >
          <ResumeAutofill
            fields={['name', 'phone', 'headline', 'barangay', 'address', 'education', 'experience', 'skills']}
            onApply={(details) => {
              for (const [key, value] of Object.entries(details)) {
                form.setValue(key as keyof ProfileValues, value, { shouldDirty: true, shouldValidate: true });
              }
            }}
          />
          <Panel
            title="Personal & contact details"
            description="Use provided information in this frontend ."
          >
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {profilePicture ? <img src={profilePicture} alt="Profile preview" className="size-full object-cover" /> : <UserRound className="size-8" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="profile-picture" className="text-sm font-semibold text-foreground">Profile picture</label>
                <p className="text-xs leading-5 text-muted-foreground">Upload a clear face photo. This  keeps it in memory until refresh.</p>
                <input id="profile-picture" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => setProfilePicture(typeof reader.result === "string" ? reader.result : null); reader.readAsDataURL(file); }} />
              </div>
            </div>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Full name"
                  required
                  {...form.register("name")}
                  error={errors.name?.message}
                />
                <TextField
                  label="Contact number"
                  required
                  type="tel"
                  {...form.register("phone")}
                  error={errors.phone?.message}
                />
              </div>
              <TextField
                label="Professional headline"
                required
                {...form.register("headline")}
                error={errors.headline?.message}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Barangay"
                  options={BARANGAYS}
                  {...form.register("barangay")}
                  error={errors.barangay?.message}
                />
                <TextField
                  label="Street or local address"
                  required
                  {...form.register("address")}
                  error={errors.address?.message}
                />
              </div>
            </FieldGroup>
          </Panel>
          <Panel
            title="Education, experience & skills"
            description="These details power simple, transparent skill matching."
          >
            <FieldGroup>
              <TagField
                label="Education or training"
                value={form.watch("education")}
                onChange={(value) => form.setValue("education", value, { shouldDirty: true, shouldValidate: true })}
                placeholder="Type a qualification and press Enter"
                error={errors.education?.message}
                required
              />
              <TagField
                label="Work experience"
                value={form.watch("experience")}
                onChange={(value) => form.setValue("experience", value, { shouldDirty: true, shouldValidate: true })}
                placeholder="Type a role or experience and press Enter"
                help="Add internships, volunteer work, or previous roles as separate tags."
                error={errors.experience?.message}
              />
              <TagField
                label="Your skills"
                value={form.watch("skills")}
                onChange={(value) => form.setValue("skills", value, { shouldDirty: true, shouldValidate: true })}
                placeholder="Type a skill and press Enter"
                help="Add each skill as a separate tag."
                error={errors.skills?.message}
                required
              />
            </FieldGroup>
          </Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Profile edits stay in memory and disappear on refresh.
            </p>
            <Button type="submit" disabled={pending}>
              <Save data-icon="inline-start" />
              {pending ? "Saving…" : "Save my profile"}
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-5">
          <Panel title="A profile that feels like you">
            <div className="soft-icon mb-4">
              <UserRound className="size-5" />
            </div>
            <p className="text-sm font-semibold text-navy">{profile.name}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {profile.headline}
            </p>
            <p className="mt-4 text-xs font-medium text-teal">
              {profileCompletion(profile)}% complete
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </Panel>
          <Notice title="Share only what is needed">
            Your profile is not a public directory entry. In production,
            applicant details must be limited to the receiving employer and
            authorized PESO personnel.
          </Notice>
        </div>
      </div>
      <div className="mt-8 border-t border-border pt-8">
        <ResumeManagement embedded />
      </div>
    </>
  );
}
