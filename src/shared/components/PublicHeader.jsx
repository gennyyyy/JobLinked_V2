import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import logoImage from "../../assets/Logo.png";
import textBasedLogo from "../../assets/TextBased Logo.png";

const howItWorksItems = [
  { label: "Jobseeker", to: "/register/job-seeker" },
  { label: "Employer", to: "/register/employer" },
  { label: "FAQ", to: "/portals" },
];

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
      <div className="w-full px-[28px] h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImage} alt="JobLinked" className="h-12 w-auto" />
          <img src={textBasedLogo} alt="JobLinked" className="h-12 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <button
              type="button"
              ref={triggerRef}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="how-it-works-menu"
              className="flex items-center gap-1 min-h-[40px] px-1 rounded-md text-gray-600 text-sm font-medium hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              How It Works
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <nav
                id="how-it-works-menu"
                ref={menuRef}
                aria-label="How It Works"
                className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-gray-100 bg-white shadow-lg py-2 z-20"
              >
                {howItWorksItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <Link
            to="/portals"
            className="min-h-[40px] inline-flex items-center px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
          >
            LOG IN
          </Link>
          <Link
            to="/register"
            className="min-h-[40px] inline-flex items-center px-5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
          >
            SIGN UP
          </Link>
        </div>
      </div>
    </header>
  );
}

export default PublicHeader;
