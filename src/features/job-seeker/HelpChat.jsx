import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { askHelp } from "../../shared/services/ai";
import useDialog from "../../shared/hooks/useDialog";

const MAX_TURNS = 10;
const FALLBACK_ERROR = "Couldn't reach the help assistant. Please try again.";

// Floating "how do I…" helper for the seeker portal. Local transcript only —
// no persistence, no store; only the last MAX_TURNS messages go to the API.
function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const transcriptRef = useRef(null);

  // Escape / Tab-trap / focus-restore + scroll lock (one-line adopter of the
  // shared dialog hook); chat still lands focus on the input on open.
  const panelRef = useDialog(close, open);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, sending]);

  function close() {
    setOpen(false);
  }

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);
    setError("");
    try {
      const { reply } = await askHelp(next.slice(-MAX_TURNS));
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err?.message || FALLBACK_ERROR);
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || !draft.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help chat"
        aria-haspopup="dialog"
        className="fixed bottom-6 right-6 z-[9998] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <HelpCircle className="h-6 w-6" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={close}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-chat-title"
            className="bg-white border border-primary rounded-lg w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 id="help-chat-title" className="text-sm font-semibold text-gray-900">Help</h2>
              <button type="button" onClick={close} aria-label="Close help chat" className="text-gray-400 hover:text-gray-900 transition-colors text-lg leading-none">×</button>
            </div>
            <div ref={transcriptRef} className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-3 min-h-[200px]">
              {messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">Ask me how to apply for a job, upload a resume, or update your profile.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[80%] break-words px-3 py-2 rounded-xl text-xs ${m.role === "user" ? "bg-primary text-white" : "bg-gray-50 border border-gray-200 text-gray-700"}`}>{m.content}</p>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <p className="px-3 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-400">Thinking…</p>
                </div>
              )}
            </div>
            {error && <p role="alert" className="px-5 py-2 text-xs text-danger border-t border-gray-100">{error}</p>}
            <form onSubmit={send} className="flex gap-2 p-4 border-t border-gray-100">
              <label htmlFor="help-chat-input" className="sr-only">Message the help assistant</label>
              <input
                id="help-chat-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
              <button type="submit" disabled={disabled} className="min-h-[44px] px-4 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Send</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default HelpChat;
