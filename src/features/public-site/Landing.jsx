import SkipLink from "../../shared/components/SkipLink";
import PublicShell from "../../shared/components/PublicShell";
import { HomeHero } from "./HomeHero";
import { CommunitySections } from "./CommunitySections";

function Landing() {
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
