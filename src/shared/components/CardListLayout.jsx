import { Label } from "../../components/ui/label";
import SearchBar from "./SearchBar";

// Standard sort/search bar shared by every page that uses CardListLayout, so the
// controls look identical everywhere (only labels/options/data differ).
function StandardControls({
  sort,
  onSortChange,
  sortOptions = [],
  sortLabel = "Sort:",
  sortAriaLabel = "Sort",
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchAriaLabel = "Search",
  controlAction = null,
}) {
  return (
    <div className="applicant-list-controls surface rounded-xl p-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchBar value={search} onChange={onSearchChange} placeholder={searchPlaceholder} ariaLabel={searchAriaLabel} />
          <Label className="flex items-center gap-2 text-xs font-semibold text-dark-blue">
            {sortLabel}
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label={sortAriaLabel}
              className="px-3 py-2 rounded-lg text-xs bg-card border border-border text-muted-foreground font-medium focus:outline-none focus:border-primary transition-all cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Label>
        </div>
        {controlAction && <div className="shrink-0">{controlAction}</div>}
      </div>
    </div>
  );
}

export default function CardListLayout({
  title,
  subtitle,
  eyebrow,
  headerAction = null,
  // Standard controls (use these for identical search/sort bars):
  sort,
  onSortChange,
  sortOptions,
  sortLabel,
  sortAriaLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  // Optional action rendered inside the search/sort container (e.g. "Post a Job"):
  controlAction = null,
  // Escape hatch for fully custom controls (avoid unless necessary):
  controls = null,
  sidebar = null,
  footer = null,
  className = "",
  children,
}) {
  const hasStandard = sort !== undefined || search !== undefined;
  return (
    <div className={`space-y-6 pb-12 ${className}`}>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-[-.035em] text-navy">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </div>
        {headerAction}
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-5">
        <div className="min-w-0 space-y-4">
          {controls
            ? controls
            : hasStandard
              ? (
                <StandardControls
                  sort={sort}
                  onSortChange={onSortChange}
                  sortOptions={sortOptions}
                  sortLabel={sortLabel}
                  sortAriaLabel={sortAriaLabel}
                  search={search}
                  onSearchChange={onSearchChange}
                  searchPlaceholder={searchPlaceholder}
                  searchAriaLabel={searchAriaLabel}
                  controlAction={controlAction}
                />
              )
              : null}
          {children}
          {footer}
        </div>
        {sidebar && <aside className="applicant-list-sidebar space-y-3">{sidebar}</aside>}
      </div>
    </div>
  );
}
