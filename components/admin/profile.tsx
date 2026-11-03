"use client";

import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel, TextField } from "@/components/shared";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { PasswordSettings } from "@/components/dashboard/password-settings";
import { ROLE_LABELS } from "@/constants";
import type { User } from "@/types";

export function AdminProfile() {
  const { user } = useDemo();
  return user ? <AdminProfileForm key={user.id} user={user} /> : null;
}

function AdminProfileForm({ user }: { user: User }) {
  const { run, pending } = useAction();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  return (
    <>
      <PageHeading
        eyebrow="Superadmin account"
        title="Profile management"
        description="Manage the profile details used across the JobLinked administration workspace."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title="Personal details"
          description="Keep your administrator identity current for workspace activity and audit records."
        >
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                async () => undefined,
                "Profile details saved for this this session.",
              );
            }}
          >
            <TextField
              label="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button type="submit" disabled={pending || !name.trim() || !email.trim()}>
              <Save data-icon="inline-start" />
              Save profile
            </Button>
          </form>
        </Panel>
        <Panel
          title="Administrator access"
          description="Your role and access level are managed by the system."
          action={<ShieldCheck className="size-5 text-teal" />}
        >
          <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{ROLE_LABELS[user.role]}</dd>
            <dt className="text-muted-foreground">Access</dt>
            <dd>Full platform administration</dd>
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="break-all">{user.id}</dd>
          </dl>
        </Panel>
      </div>
      <div className="mt-6">
        <PasswordSettings />
      </div>
    </>
  );
}
