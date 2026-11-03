import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useState } from "react";
import { createPortal } from "react-dom";
import useDialog from "../../shared/hooks/useDialog";

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI job matching"
        className="bg-card border border-primary rounded-lg w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">AI</p>
          <Button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Ask about jobs that fit you.</p>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${m.role === "user" ? "bg-primary text-white" : "bg-muted border border-border text-muted-foreground"}`}>{m.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2 p-4 border-t border-border">
          <Input
            aria-label="Type a message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <Button type="submit" className="min-h-[44px] px-4 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">Send</Button>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default AiMatchModal;
