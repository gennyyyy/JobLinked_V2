import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import SkipLink from "../../shared/components/SkipLink";
import PublicShell from "../../shared/components/PublicShell";
import { HomeHero } from "./HomeHero";
import { CommunitySections } from "./CommunitySections";

function Landing() {
  const { hash } = useLocation();

  // React Router's pushState does not scroll to in-page anchors for us.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

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
