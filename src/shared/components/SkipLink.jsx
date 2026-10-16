// WCAG 2.4.1 bypass block: first focusable on every page; jumps to <main id="main-content">.
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:min-h-[44px] focus:inline-flex focus:items-center focus:px-4 focus:rounded-xl focus:bg-dark-blue focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}
