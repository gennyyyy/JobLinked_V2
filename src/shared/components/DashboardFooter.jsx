import { Link } from 'react-router-dom'

// Minimal dashboard footer shared by the three portals. `mt-auto` keeps it
// pinned to the bottom of the viewport when the page content is short.
export default function DashboardFooter() {
  return (
    <div className="no-print mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 px-8 pb-3 pt-2 text-[10px] text-muted-foreground">
      <span>JobLinked · Santa Maria, Bulacan</span>
      <div className="flex gap-4">
        <Link to="/privacy">Privacy Notice</Link>
        <Link to="/terms">Terms</Link>
      </div>
    </div>
  )
}
