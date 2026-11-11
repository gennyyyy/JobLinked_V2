import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FormSelect({ className, children, ...props }) {
  return (
    <div className="relative">
      <select {...props} className={cn("w-full appearance-none pr-10", className)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
