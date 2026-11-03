"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  GraduationCap,
  ShieldCheck,
  ArrowUpRight,
  FlaskConical,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { ConfirmButton, SelectField } from "@/components/shared";
import { ROLE_LABELS } from "@/constants";
import type { Role } from "@/types";

export function DemoSwitcher({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const { state, api, user } = useDemo();
  const { run, pending } = useAction();
  const router = useRouter();
  const change = async (role: Role) => {
    await run(async () => {
      await api.previewRole(role);
      setOpen(false);
      router.push(`/${role}/dashboard`);
    });
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 items-center gap-2 text-[11px] font-medium transition-opacity hover:opacity-75"
        aria-label="Explore demo roles"
      >
        <FlaskConical className="size-3.5" />
        {compact ? "Switch demo role" : "Interactive demo"}
        <ArrowUpRight className="size-3" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>One community. Three perspectives.</DialogTitle>
            <DialogDescription>
              Explore connected sample workflows. These role previews are not
              production authentication. Use fictional information only.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {(
              [
                {
                  role: "jobseeker",
                  icon: GraduationCap,
                  description:
                    "Find, save, apply, and track your next opportunity.",
                },
                {
                  role: "employer",
                  icon: Building2,
                  description: "Manage vacancies and review your applicants.",
                },
                {
                  role: "admin",
                  icon: ShieldCheck,
                  description:
                    "Review accreditation and explore employment reports.",
                },
              ] as const
            ).map(({ role, icon: Icon, description }) => (
              <button
                disabled={pending}
                className="flex min-h-20 items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:border-primary/40 hover:bg-blue-soft"
                key={role}
                onClick={() => change(role)}
              >
                <span className="soft-icon">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-navy">
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                  </span>
                </span>
                <ArrowUpRight className="size-4 text-primary" />
              </button>
            ))}
          </div>
          {state.users.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
              <SelectField
                label="Resume another sample account"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                placeholder="Select an account"
                options={state.users
                  .filter((u) => u.active)
                  .map((u) => ({
                    value: u.id,
                    label: `${u.name} · ${ROLE_LABELS[u.role]}${u.id === user?.id ? " (current)" : ""}`,
                  }))}
              />
              <Button
                variant="outline"
                disabled={!selected || pending}
                onClick={() =>
                  run(async () => {
                    await api.selectDemoAccount(selected);
                    const account = state.users.find((u) => u.id === selected)!;
                    setOpen(false);
                    router.push(
                      `/${account.role === "staff" ? "admin" : account.role}/dashboard`,
                    );
                  })
                }
              >
                Open selected portal
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </div>
          )}
          <p className="text-[11px] leading-5 text-muted-foreground">
            Changes are shared across these portals in this browser. Newly
            entered profiles, file metadata, and notes are memory-only and
            disappear on refresh.
          </p>
          <ConfirmButton
            title="Reset the entire demo?"
            description="Restore all fictional fixtures and clear stored workflow changes. This will sign you out of the role preview."
            onConfirm={async () => {
              await api.reset();
              setOpen(false);
              router.push("/");
            }}
            variant="ghost"
          >
            <RotateCcw data-icon="inline-start" />
            Reset demo
          </ConfirmButton>
        </DialogContent>
      </Dialog>
    </>
  );
}
