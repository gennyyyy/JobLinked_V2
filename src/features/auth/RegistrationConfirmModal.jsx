import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function RegistrationConfirmModal({
  open,
  error,
  busy,
  title,
  description,
  heading,
  points,
  note,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Keep editing',
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <DialogContent className="gap-5 p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <section
          aria-labelledby="registration-confirm-explainer"
          className="rounded-xl border border-border bg-muted/60 p-4 text-xs leading-6 text-muted-foreground"
        >
          <h3 id="registration-confirm-explainer" className="text-sm font-semibold text-dark-blue">
            {heading}
          </h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            {points.map((point) => <li key={point}>{point}</li>)}
          </ol>
          <p className="mt-3">{note}</p>
        </section>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-10 w-full px-5 sm:w-auto" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" className="min-h-10 w-full px-5 sm:w-auto" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RegistrationConfirmModal;
