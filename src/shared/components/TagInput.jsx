import { useState } from "react";

// TagInput + its splitTags helper move together from Profile.
// eslint-disable-next-line react-refresh/only-export-components
export function splitTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((t) => String(t).trim()).filter(Boolean);
}

// Minimal tag input — type + Enter/comma to add, Backspace or × to remove.
// Reused for preferred jobs + preferred locations; values stay comma-separated
// strings so the existing text columns need no migration.
export function TagInput({ value, onChange, placeholder, id }) {
  const [draft, setDraft] = useState("");
  const tags = splitTags(value);

  function commit(raw) {
    const parts = splitTags(raw);
    if (!parts.length) return;
    const next = [...tags];
    for (const part of parts) {
      if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next.join(", "));
    setDraft("");
  }

  function removeTag(tag) {
    onChange(tags.filter((t) => t !== tag).join(", "));
  }

  return (
    <div className="w-full min-h-[44px] px-3 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="hover:text-primary-hover font-bold leading-none">×</button>
          </span>
        ))}
        <input
          id={id}
          aria-label={placeholder || "Tags input"}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) commit(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(draft); }
            else if (e.key === "Backspace" && !draft && tags.length) { removeTag(tags[tags.length - 1]); }
          }}
          onBlur={() => commit(draft)}
          placeholder={tags.length ? "" : placeholder}
          className="flex-1 min-w-[140px] bg-transparent outline-none placeholder:text-gray-400 py-1"
        />
      </div>
    </div>
  );
}
