"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, CalendarDays, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PageHeading,
  Panel,
  TextField,
  SelectField,
  ConfirmButton,
  Notice,
  EmptyState,
} from "@/components/shared";
import { SearchInput } from "@/components/dashboard/list-controls";
import { useDemo } from "@/hooks/use-demo";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import type { Announcement } from "@/types";

const categories = [
  "Community notice",
  "Job fair",
  "Career guidance",
  "Skills training",
  "Vacancy bulletin",
];
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Use a clear title of at least 5 characters.")
    .max(160),
  body: z
    .string()
    .trim()
    .min(15, "Add at least 15 characters of information.")
    .max(5000),
  category: z.string().min(1),
  distributionDate: z.string(),
  published: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function AnnouncementManagement() {
  const { state, api } = useDemo();
  const { run } = useAction();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const records = state.announcements.filter((a) =>
    `${a.title} ${a.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Keep your community connected"
        title="A little information opens new doors."
        description="Create employment notices and preview a vacancy distribution plan."
        action={
          <Button onClick={() => setSelected("new")}>
            <Plus data-icon="inline-start" />
            Create announcement
          </Button>
        }
      />
      <div className="mb-6">
        <Notice title="No automatic distribution">
          Published  notices appear on the PESO Services page and in-app
          inboxes. A distribution date is a planning marker only; Facebook,
          email, SMS, and government-system integrations are unavailable.
        </Notice>
      </div>
      <Panel
        title="Your employment notices"
        description="Published notices and working drafts, together in one place."
      >
        <div className="mb-5 max-w-xl">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search announcements…"
          />
        </div>
        {records.length ? (
          <ul className="flex flex-col gap-4">
            {records.map((item) => (
              <li key={item.id} className="rounded-xl border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge variant={item.published ? "secondary" : "outline"}>
                        {item.published ? "Published · " : "Draft"}
                      </Badge>
                      <Badge variant="outline">{item.category}</Badge>
                    </div>
                    <h2 className="text-base font-semibold">{item.title}</h2>
                    <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-7 text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => setSelected(item.id)}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      title="Delete this announcement?"
                      description="This removes the notice from the  public page. Existing inbox notifications may remain as historical records."
                      onConfirm={() =>
                        run(
                          () => api.deleteAnnouncement(item.id),
                          "announcement deleted.",
                        )
                      }
                    >
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-muted-foreground">
                  <span>Notice date: {formatDate(item.date)}</span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3" />
                    {item.distributionDate
                      ? `Mock distribution plan: ${formatDate(item.distributionDate)}`
                      : "No distribution date planned"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Make space for a useful update."
            description="No announcements match this search. Create a notice to see it here."
          />
        )}
      </Panel>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {selected && (
            <AnnouncementEditor
              key={selected}
              announcement={state.announcements.find((a) => a.id === selected)}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnnouncementEditor({
  announcement,
  onClose,
}: {
  announcement?: Announcement;
  onClose: () => void;
}) {
  const { api } = useDemo();
  const { run, pending } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: announcement?.title ?? "",
      body: announcement?.body ?? "",
      category: announcement?.category ?? categories[0],
      distributionDate: announcement?.distributionDate.slice(0, 10) ?? "",
      published: announcement?.published ?? false,
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {announcement
            ? "Edit employment notice"
            : "Create a useful community notice"}
        </DialogTitle>
        <DialogDescription>
          Use clearly provided, information. Publishing affects only
          this connected frontend .
        </DialogDescription>
      </DialogHeader>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          run(async () => {
            await api.saveAnnouncement(
              {
                ...values,
                date: announcement?.date ?? new Date().toISOString(),
              },
              announcement?.id,
            );
            onClose();
          }, "announcement saved."),
        )}
      >
        <FieldGroup>
          <TextField
            label="Announcement title"
            required
            {...form.register("title")}
            error={form.formState.errors.title?.message}
          />
          <SelectField
            label="Category"
            options={[
              ...new Set([
                ...categories,
                ...(announcement ? [announcement.category] : []),
              ]),
            ]}
            {...form.register("category")}
          />
          <TextField
            label="Notice content"
            multiline
            rows={5}
            required
            {...form.register("body")}
            error={form.formState.errors.body?.message}
          />
          <TextField
            label="Mock distribution date (optional)"
            type="date"
            {...form.register("distributionDate")}
            help="Planning only. No task is scheduled and no message will be sent."
          />
          <Field orientation="horizontal">
            <Field>
              <FieldLabel htmlFor="publish-announcement">
                Publish
              </FieldLabel>
              <FieldDescription>
                Show this notice on PESO Services and create in-app
                notifications.
              </FieldDescription>
            </Field>
            <Controller
              control={form.control}
              name="published"
              render={({ field }) => (
                <Switch
                  id="publish-announcement"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Field>
          <Button disabled={pending} type="submit">
            <Save data-icon="inline-start" />
            {pending ? "Saving…" : "Save notice"}
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
