import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import FormSelect from "./FormSelect";
import useVocabulary from "../hooks/useVocabulary";

const CHIP = "inline-flex items-center rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";


const byLower = (list) => new Map(list.map((value) => [String(value).toLowerCase(), value]));
const positionOf = (list) => new Map(list.map((value, index) => [String(value).toLowerCase(), index]));
const sortByVocabulary = (list, positions) => [...list].sort(
  (a, b) => (positions.get(a.toLowerCase()) ?? Infinity) - (positions.get(b.toLowerCase()) ?? Infinity),
);

// Help/error feedback shared by both variants. Loading is a role=status so a
// screen reader hears it without moving focus; a load failure offers Retry,
// which re-runs useVocabulary's loader (a failed promise is evicted).
function PickerFeedback({ helpId, helpText, loading, error, errorId, loadError, onRetry }) {
  return (
    <>
      {helpText && <p id={helpId} className="mt-2 text-xs text-muted-foreground">{helpText}</p>}
      {loading && <p role="status" className="mt-2 text-sm text-muted-foreground">Loading options…</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
      {loadError && (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </p>
      )}
    </>
  );
}

// Controlled vocabulary picker fed by GET /reference/:category.
//   multiple (skills) -> native checkbox chips in canonical order, capped at `max`
//   single (job field) -> native <select>; "Not set" emits null
// `value` is string[] for multiple (a comma-separated string is also accepted)
// and string|null for single. Selected values are matched case-insensitively
// and emitted in the vocabulary's canonical casing/order.
export default function VocabularyPicker({
  id,
  label,
  category,
  value,
  onChange,
  multiple = true,
  max = 20,
  help,
  required = false,
  error,
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const labelId = `${fieldId}-label`;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const { values, loading, error: loadError, reload } = useVocabulary(category);

  const canonical = byLower(values);
  const positions = positionOf(values);
  const limit = Number.isFinite(max) ? max : null;

  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  const selected = multiple ? [] : null;
  if (multiple) {
    for (const raw of list) {
      const text = String(raw).trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (selected.some((entry) => entry.toLowerCase() === key)) continue;
      selected.push(canonical.get(key) ?? text);
    }
    selected.sort(
      (a, b) => (positions.get(a.toLowerCase()) ?? Infinity) - (positions.get(b.toLowerCase()) ?? Infinity),
    );
  }

  const options = [...values];
  if (multiple) {
    for (const entry of selected) {
      if (!canonical.has(entry.toLowerCase())) options.push(entry);
    }
  }

  const rawSingle = Array.isArray(value) ? value[0] : value;
  const single = rawSingle == null ? "" : String(rawSingle);
  const singleValue = canonical.get(single.toLowerCase()) ?? single;
  if (!multiple && singleValue && !canonical.has(singleValue.toLowerCase())) options.push(singleValue);

  const atMax = multiple && limit != null && selected.length >= limit;
  const helpText = [
    help,
    multiple && limit != null && values.length ? `Select up to ${limit}.` : "",
  ].filter(Boolean).join(" ");
  const describedBy = [helpText ? helpId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  function toggle(option, checked) {
    if (checked) {
      if (atMax) return;
      onChange(sortByVocabulary([...selected, option], positions));
    } else {
      onChange(selected.filter((entry) => entry.toLowerCase() !== option.toLowerCase()));
    }
  }

  const feedback = (
    <PickerFeedback
      helpId={helpId}
      helpText={helpText}
      loading={loading}
      error={error}
      errorId={errorId}
      loadError={loadError}
      onRetry={reload}
    />
  );

  if (multiple) {
    return (
      <div className="w-full">
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          aria-busy={loading || undefined}
        >
          <p id={labelId} className="mb-2 text-sm font-medium leading-none">
            {label}
            {required && <span aria-hidden="true" className="text-destructive"> *</span>}
          </p>
          {!loading && options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const checked = selected.some((entry) => entry.toLowerCase() === option.toLowerCase());
                const disabled = !checked && atMax;
                return (
                  <label key={option} className={cn("inline-flex", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) => toggle(option, event.target.checked)}
                    />
                    <span className={CHIP}>{option}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        {feedback}
      </div>
    );
  }

  return (
    <div className="w-full">
      <Label htmlFor={fieldId} className="mb-2">
        {label}
        {required && <span aria-hidden="true" className="text-destructive">*</span>}
      </Label>
      <div className="flex min-h-[44px] items-center rounded-xl border border-border bg-muted px-4 py-2">
      <FormSelect
        id={fieldId}
        required={required}
        disabled={loading}
        value={singleValue}
        onChange={(event) => onChange(event.target.value || null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="w-full border-0 bg-transparent text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Not set</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </FormSelect>
      </div>
      {feedback}
    </div>
  );
}
