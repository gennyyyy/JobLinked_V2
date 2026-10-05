import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";

function SidebarAccount({ user, profileTo, roleLabel, onNavigate, onLogout }) {
  const name = user?.full_name || user?.name || user?.email || roleLabel;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="p-4 border-t border-white/10 bg-dark-blue">
      <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 p-2">
        <Link
          to={profileTo}
          onClick={onNavigate}
          className="min-w-0 flex-1 flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-white/10 transition-colors"
        >
          <span className="w-8 h-8 shrink-0 rounded-lg bg-accent/20 border border-accent/30 text-accent flex items-center justify-center text-xs font-bold">
            {initials || "U"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white">{name}</span>
            <span className="block truncate mt-0.5 text-[10px] text-white/50 uppercase tracking-wider">{roleLabel}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
          className="shrink-0 p-2 rounded-lg text-white/60 hover:text-danger hover:bg-white/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default SidebarAccount;
