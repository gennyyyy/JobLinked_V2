import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import useDialog from "@/shared/hooks/useDialog";

// Placeholder chat UI — backend not wired yet. Reuses ConfirmationModal overlay.
function AiMatchModal({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const panelRef = useDialog(onClose, open);
  if (!open || typeof document === "undefined") return null;

  function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: "Not connected yet — backend coming." }]);
    setDraft("");
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI job matching"
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">AI</p>
            <h2 className="mt-1 text-sm font-semibold">Job matching</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Ask about jobs that fit you.</p>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-5 ${m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-muted text-muted-foreground"}`}>{m.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t px-4 py-4">
          <Input
            aria-label="Type a message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="h-11 flex-1"
          />
          <Button type="submit" className="px-4">Send</Button>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default AiMatchModal;
