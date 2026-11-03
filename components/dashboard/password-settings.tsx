"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Panel, TextField } from "@/components/shared";
import { DEMO_PASSWORD } from "@/constants";

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter the sample account password."),
    password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Z]/, "Include an uppercase letter.").regex(/[0-9]/, "Include a number."),
    confirm: z.string().min(1, "Confirm the new sample password."),
  })
  .refine((values) => values.password === values.confirm, { path: ["confirm"], message: "The passwords do not match." })
  .refine((values) => values.current === DEMO_PASSWORD, { path: ["current"], message: "Use Demo123! in this frontend demonstration." });

type PasswordValues = z.infer<typeof passwordSchema>;

export function PasswordSettings() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", password: "", confirm: "" },
  });

  return (
    <Panel
      title="Password settings"
      description="Update your sample password from your profile. No password or authentication credential is stored or changed."
    >
      <form noValidate onSubmit={form.handleSubmit(() => { form.reset(); toast.info("Password fields validated. No password was changed; the demo login remains Demo123!."); })}>
        <FieldGroup>
          <TextField label="Current sample password" type="password" autoComplete="off" {...form.register("current")} error={form.formState.errors.current?.message} />
          <TextField label="New sample password" type="password" autoComplete="off" help="8+ characters with an uppercase letter and number. Do not enter a real password." {...form.register("password")} error={form.formState.errors.password?.message} />
          <TextField label="Confirm new sample password" type="password" autoComplete="off" {...form.register("confirm")} error={form.formState.errors.confirm?.message} />
          <Button type="submit" variant="outline"><LockKeyhole data-icon="inline-start" />Validate password fields</Button>
        </FieldGroup>
      </form>
    </Panel>
  );
}
