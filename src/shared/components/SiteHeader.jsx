import { Link } from "react-router-dom";
import logoImage from "../../assets/logo-256.png";
import textBasedLogo from "../../assets/wordmark-400.png";

function SiteHeader({ center = null, right = null, homeTo = "/" }) {
  return (
    <header className="sticky top-0 z-20 shrink-0 bg-card border-b border-border  shadow-sm">
      <div className="w-full px-[28px] h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Link to={homeTo} className="flex items-center gap-2 shrink-0 justify-self-start">
          <img src={logoImage} alt="JobLinked" width={256} height={256} className="h-12 w-auto" />
          <span className="brand-mark-surface flex items-center rounded-md px-1.5 py-1">
            <img src={textBasedLogo} alt="JobLinked" width={400} height={133} className="h-10 w-auto" />
          </span>
        </Link>
        <div className="justify-self-center">{center}</div>
        <div className="justify-self-end flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}

export default SiteHeader;
