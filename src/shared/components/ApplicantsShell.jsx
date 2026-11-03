import { Button } from "../../components/ui/button";
import { Users } from "lucide-react";
import CardListLayout from "./CardListLayout";

const DEFAULT_SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
];

function getCardTone(className = "") {
  if (/emerald|green/.test(className)) return "success";
  if (/amber|yellow/.test(className)) return "warning";
  if (/rose|red|danger/.test(className)) return "danger";
  if (/purple|violet/.test(className)) return "purple";
  if (/gray/.test(className)) return "neutral";
  return "info";
}

export default function ApplicantsShell({
  title = "Applicant Tracking",
  subtitle,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search applicant",
  searchAriaLabel = "Search applicants",
  sort = "newest",
  onSortChange,
  sortLabel = "Sort:",
  sortAriaLabel = "Sort applicants",
  sortOptions = DEFAULT_SORT_OPTIONS,
  isEmpty = false,
  emptyTitle = "No applicants yet",
  emptyBody,
  emptyAction,
  emptyIcon,
  onClearFilters,
  filters = [],
  activeFilter,
  onFilterChange,
  children,
  aside,
  className = "",
  ...layoutProps
}) {
  const icon = emptyIcon || <Users className="w-8 h-8 text-gray-300" strokeWidth={1.5} />;
  const statusCards = filters.length ? (
    <div className="space-y-3">
      {filters.map((card) => (
        <Button
          key={card.value}
          type="button"
          data-tone={getCardTone(card.className)}
          aria-pressed={activeFilter === card.value}
          onClick={() => onFilterChange?.(card.value)}
          className={`w-full text-left rounded-lg border px-4 py-3 transition-all cursor-pointer ${card.className} ${activeFilter === card.value ? "ring-1 ring-offset-0 ring-current" : ""}`}
        >
          <p className="text-2xl font-bold">{card.count}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">{card.label}</p>
        </Button>
      ))}
    </div>
  ) : null;

  return (
    <CardListLayout
      {...layoutProps}
      title={title}
      subtitle={subtitle}
      className={`applicant-list-shell ${className}`}
      search={onSearchChange ? search : undefined}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchAriaLabel={searchAriaLabel}
      sort={onSortChange ? sort : undefined}
      onSortChange={onSortChange}
      sortOptions={sortOptions}
      sortLabel={sortLabel}
      sortAriaLabel={sortAriaLabel}
      sidebar={aside ?? layoutProps.sidebar ?? statusCards}
    >
      {isEmpty ? (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">{icon}</div>
          <p className="font-semibold text-foreground mb-1">{emptyTitle}</p>
          {emptyBody ? (typeof emptyBody === "string" ? <p className="text-sm text-muted-foreground max-w-sm mx-auto">{emptyBody}</p> : emptyBody) : null}
          {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
          {onClearFilters ? <Button type="button" onClick={onClearFilters} className="mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer">Clear all filters</Button> : null}
        </div>
      ) : children}
    </CardListLayout>
  );
}
