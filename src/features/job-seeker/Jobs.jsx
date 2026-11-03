import { Button } from "@/components/ui/button";
import { useState } from "react";
import useAuth from "@/shared/hooks/useAuth";
import AiMatchModal from "./AiMatchModal";
import BrowseJobs from "@/shared/components/BrowseJobs";
import { PageHeading } from "@/shared/components/design";

function Jobs() {
  const { user } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);
  const skills = Array.isArray(user?.skills) ? user.skills : [];

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Opportunities in Santa Maria"
        title="Browse Verified Openings"
        description="Search verified positions from accredited employers in Santa Maria."
      />

      <BrowseJobs
        jobHref={(id) => `/job-seeker/jobs/${id}`}
        initialSkills={skills.slice(0, 3)}
        toolbar={
          <Button
            type="button"
            variant="outline"
            onClick={() => setAiOpen(true)}
            aria-label="Open AI job matching"
            title="AI Job Matching"
            className="border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
          >
            <span className="text-xs font-bold tracking-wide">AI</span>
          </Button>
        }
      />

      <AiMatchModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

export default Jobs;
