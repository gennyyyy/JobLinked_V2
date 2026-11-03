import { Button } from "../../components/ui/button";
import { createPortal } from "react-dom";
import useDialog from "../hooks/useDialog";

function ConfirmationModal({ message, onConfirm, onCancel, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, children }) {
  const panelRef = useDialog(onCancel);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-describedby="confirmation-message"
        className="bg-card border border-primary rounded-lg p-5 w-full max-w-md shadow-2xl"
      >
        <p id="confirmation-message" className="text-sm text-muted-foreground mb-6">{message}</p>
        {children}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer ${danger ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'}`}
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
