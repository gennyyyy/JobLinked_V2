import { Search, X } from "lucide-react";

// The one search bar used by every CardListLayout page, so it looks identical
// everywhere (only placeholder/aria-label/data differ).
export default function SearchBar({ value, onChange, placeholder, ariaLabel }) {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex items-stretch w-full sm:w-72">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full pl-9 pr-3 py-2 rounded-l-lg text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-card transition-all"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button type="submit" className="bg-navy text-white text-sm font-semibold px-4 rounded-r-lg cursor-pointer">
        Search
      </button>
    </form>
  );
}