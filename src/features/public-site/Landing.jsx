import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import SkipLink from "../../shared/components/SkipLink";
import PublicShell from "../../shared/components/PublicShell";
import { HomeHero } from "./HomeHero";
import { CommunitySections } from "./CommunitySections";

function Landing() {
  const { hash } = useLocation();
  const lastHash = useRef(null);

  // Scroll on hash change (mount at /#faq or navigation). Guard against
  // re-scrolling the same hash that a click already handled.
  useEffect(() => {
    if (!hash) return;
    if (lastHash.current === hash) return;
    lastHash.current = hash;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  // Scroll on every click of an in-page anchor link, including repeat clicks
  // that don't change the URL hash.
  useEffect(() => {
    function onClick(e) {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const i = href.indexOf("#");
      if (i < 0) return;
      const id = href.slice(i + 1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      lastHash.current = "#" + id;
      el.scrollIntoView({ block: "start" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <SkipLink />
      <PublicShell>
        <HomeHero />
        <CommunitySections />
      </PublicShell>
    </div>
  );
}

export default Landing;
