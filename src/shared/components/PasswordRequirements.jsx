import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/shared/utils/password";

export default function PasswordRequirements({ value = "" }) {
  return (
    <ul aria-label="Password requirements" className="mt-1 space-y-1">
      {PASSWORD_RULES.map(({ id, label, test }) => {
        const met = test(value);
        return (
          <li
            key={id}
            className={`flex items-center gap-1.5 text-xs ${met ? "text-success" : "text-muted-foreground"}`}
          >
            {met ? (
              <Check aria-hidden="true" className="size-3.5 shrink-0" />
            ) : (
              <Circle aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
            {label}
          </li>
        );
      })}
    </ul>
  );
}
