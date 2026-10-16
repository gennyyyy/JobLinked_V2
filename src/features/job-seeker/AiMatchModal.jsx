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
        className="bg-white border border-primary rounded-lg w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-mono text-xs font-medium tracking-widest text-gray-500 uppercase">AI</p>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-900 transition-colors text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">Ask about jobs that fit you.</p>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${m.role === "user" ? "bg-primary text-white" : "bg-gray-50 border border-gray-200 text-gray-700"}`}>{m.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2 p-4 border-t border-gray-100">
          <input
            aria-label="Type a message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <button type="submit" className="min-h-[44px] px-4 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">Send</button>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default AiMatchModal;
