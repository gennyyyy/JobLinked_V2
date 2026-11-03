"use client";

import { useId } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 8;

export function SearchInput({
  value,
  onChange,
  placeholder = "Search records…",
  label = "Search records",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`min-w-0 flex-1 ${className ?? ""}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <InputGroup>
        <InputGroupInput
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export function ListPagination({
  total,
  page,
  onChange,
  pageSize = PAGE_SIZE,
}: {
  total: number;
  page: number;
  onChange: (page: number) => void;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
      <p aria-live="polite">
        {total === 0
          ? "No records"
          : `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} of ${total} records`}
      </p>
      <nav aria-label="Results pagination" className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-2">
          {current} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}
