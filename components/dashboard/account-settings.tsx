"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Save,
  Mail,
  ShieldCheck,
  RotateCcw,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  PageHeading,
  Panel,
  TextField,
  Notice,
  ConfirmButton,
  LinkButton,
} from "@/components/shared";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { DEMO_PASSWORD, ROLE_LABELS } from "@/constants";
import type { User } from "@/types";

export function AccountSettings() {
  const { user } = useDemo();
  return user ? <AccountSettingsForm key={user.id} user={user} /> : null;
}

function AccountSettingsForm({ user }: { user: User }) {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const prefs = state.userPreferences?.[user.id] ?? state.preferences;
  const [updates, setUpdates] = useState(prefs.applicationUpdates);
  const [announcements, setAnnouncements] = useState(prefs.announcements);
  return (
    <>
      <PageHeading
        eyebrow="Make yourself at home"
        title={
          user.role === "admin"
            ? "Workspace & system settings"
            : "Your account, your preferences."
        }
        description="Review your sample account, notification preferences, and privacy information."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Account overview"
            description="This is a fictional demo identity, not a production account."
          >
            <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{user.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{user.email}</dd>
              <dt className="text-muted-foreground">Workspace</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
            </dl>
            {user.role !== "admin" && (
              <LinkButton
                variant="outline"
                href={`/${user.role}/profile`}
                className="mt-5"
              >
                Edit {user.role === "employer" ? "company" : "my"} profile
              </LinkButton>
            )}
          </Panel>
          <Panel
            title="Notifications"
            description="Preferences apply only to your current demo account."
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () =>
                    api.updateNotificationPreferences({
                      applicationUpdates: updates,
                      announcements,
                    }),
                  "Your session notification preferences were saved.",
                );
              }}
            >
              <FieldGroup>
                <Field orientation="horizontal">
                  <Field>
                    <FieldLabel htmlFor="application-updates">
                      Application & recruitment updates
                    </FieldLabel>
                    <FieldDescription>
                      Sample application, interview, and accreditation notices.
                    </FieldDescription>
                  </Field>
                  <Switch
                    id="application-updates"
                    checked={updates}
                    onCheckedChange={setUpdates}
                  />
                </Field>
                <Field orientation="horizontal">
                  <Field>
                    <FieldLabel htmlFor="community-notices">
                      Community announcements
                    </FieldLabel>
                    <FieldDescription>
                      Sample PESO programs and employment notices.
                    </FieldDescription>
                  </Field>
                  <Switch
                    id="community-notices"
                    checked={announcements}
                    onCheckedChange={setAnnouncements}
                  />
                </Field>
                <Button type="submit" disabled={pending}>
                  <Save data-icon="inline-start" />
                  Save preferences
                </Button>
              </FieldGroup>
            </form>
          </Panel>

        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Privacy comes first"
            action={<ShieldCheck className="size-5 text-teal" />}
          >
            <p className="text-xs leading-6 text-muted-foreground">
              Review what a future production service would process and who
              could access it. These configurable drafts require organizational
              and legal review.
            </p>
            <div className="mt-4 flex flex-col">
              <Link className="text-link text-xs" href="/privacy">
                Read the full Privacy Notice
              </Link>
              <Link className="text-link text-xs" href="/terms">
                Review the demo Terms
              </Link>
            </div>
          </Panel>
          <Notice title="A preview, not production auth">
            Frontend role guards are for demonstration only. Password hashing,
            server-side authorization, secure sessions, and account deletion
            belong to the future Express backend.
          </Notice>
          <Panel
            title="Start a fresh demonstration"
            description="Reset all fictional workflow changes stored in this browser."
          >
            <ConfirmButton
              variant="outline"
              title="Reset this demo?"
              description="This clears sample job edits, applications, saved jobs, approvals, and session-only profiles. You will be signed out. This cannot be undone."
              onConfirm={() =>
                run(() => api.reset(), "The sample workspace has been reset.")
              }
            >
              <RotateCcw data-icon="inline-start" />
              Reset demo
            </ConfirmButton>
          </Panel>
        </div>
      </div>
      {user.role === "admin" && <SystemSettings />}
    </>
  );
}

function SystemSettings() {
  const { state, api } = useDemo();
  const { run, pending } = useAction();
  const [requirements, setRequirements] = useState(
    state.preferences.requirements.join("\n"),
  );
  const [privacy, setPrivacy] = useState(state.preferences.privacyText);
  const [terms, setTerms] = useState(state.preferences.termsText);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const categories = [
      ...new Set(
        requirements
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !categories.length ||
      categories.length > 8 ||
      categories.some((r) => r.length > 80)
    ) {
      setError(
        "Provide 1–8 requirement categories, each at most 80 characters.",
      );
      return;
    }
    if (privacy.trim().length < 200 || terms.trim().length < 100) {
      setError(
        "Keep a complete draft notice (200+ characters) and terms (100+ characters).",
      );
      return;
    }
    setError("");
    await run(
      () =>
        api.updatePreferences({
          requirements: categories,
          privacyText: privacy.trim(),
          termsText: terms.trim(),
        }),
      "System drafts updated for this demo session.",
    );
  };
  return (
    <div className="mt-8 flex flex-col gap-6">
      <Panel
        title="PESO-configurable requirements & policy drafts"
        description="Changes are reflected in both registration journeys and accreditation forms. Session-only; not a legal publishing system."
      >
        <form onSubmit={submit}>
          <FieldGroup>
            <TextField
              label="Accreditation requirement categories"
              multiline
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              help="One category per line. Adding a requirement means it must be present before a future accreditation approval."
            />
            <TextField
              label="Complete draft Privacy Notice"
              multiline
              rows={12}
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
            />
            <TextField
              label="Draft Terms"
              multiline
              rows={8}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button disabled={pending} type="submit">
              <Save data-icon="inline-start" />
              Save system drafts
            </Button>
          </FieldGroup>
        </form>
      </Panel>
      <Panel
        title="Future service connections"
        description="Integration-ready UI only. No messages are sent and no government systems are connected."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Email & SMS",
              icon: Mail,
              text: "Delivery providers, opt-ins, templates, and webhook events.",
            },
            {
              title: "Vacancy distribution",
              icon: Unplug,
              text: "Authorized publishing channels and a real distribution scheduler.",
            },
            {
              title: "Government systems",
              icon: ShieldCheck,
              text: "Approved data-sharing agreements and scoped backend access.",
            },
          ].map(({ title, icon: Icon, text }) => (
            <div key={title} className="rounded-xl border bg-muted p-5">
              <Icon className="mb-4 size-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {text}
              </p>
              <p className="mt-3 text-[10px] font-medium text-warning">
                Unavailable in this frontend demo
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
