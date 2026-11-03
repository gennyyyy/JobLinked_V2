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
        className="bg-white border border-primary rounded-lg p-5 w-full max-w-md shadow-2xl"
      >
        <p id="confirmation-message" className="text-sm text-gray-700 mb-6">{message}</p>
        {children}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer ${danger ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmationModal;
