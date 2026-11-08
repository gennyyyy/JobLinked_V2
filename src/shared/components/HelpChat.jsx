import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import { askHelp } from "@/shared/services/ai";
import useDialog from "@/shared/hooks/useDialog";

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
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help chat"
        aria-haspopup="dialog"
        className="fixed bottom-6 right-6 z-[9998] size-14 rounded-full shadow-lg"
      >
        <HelpCircle className="size-6" aria-hidden="true" />
      </Button>
      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs" onClick={close}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-chat-title"
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div className="min-w-0">
                <p className="eyebrow">Support</p>
                <h2 id="help-chat-title" className="mt-1 text-sm font-semibold">Help</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close help chat">
                <X />
              </Button>
            </div>
            <div ref={transcriptRef} className="min-h-[200px] flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-5 py-4">
              {messages.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">Ask me how to apply for a job, upload a resume, or update your profile.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[80%] break-words rounded-2xl px-3.5 py-2 text-xs leading-5 ${m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-muted text-muted-foreground"}`}>{m.content}</p>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <p className="rounded-2xl border bg-muted px-3.5 py-2 text-xs text-muted-foreground">Thinking…</p>
                </div>
              )}
            </div>
            {error && <p role="alert" className="border-t px-5 py-2 text-xs text-danger">{error}</p>}
            <form onSubmit={send} className="flex gap-2 border-t px-4 py-4">
              <Label htmlFor="help-chat-input" className="sr-only">Message the help assistant</Label>
              <Input
                id="help-chat-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="h-11 flex-1"
              />
              <Button type="submit" disabled={disabled} className="px-4">Send</Button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default HelpChat;
