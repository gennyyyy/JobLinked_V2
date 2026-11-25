import { Button } from "../../components/ui/button";
import { createPortal } from "react-dom";
import useDialog from "../hooks/useDialog";

function ConfirmationModal({ title = "Confirmation", message, onConfirm, onCancel, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, children }) {
  const panelRef = useDialog(onCancel);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay z-[9999]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
        className="modal-panel w-full max-w-md"
      >
        <h2 id="confirmation-title" className="sr-only">{title}</h2>
        <p id="confirmation-message" className="text-sm text-muted-foreground mb-6">{message}</p>
        {children}
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className={`text-white transition-colors cursor-pointer ${danger ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmationModal;
