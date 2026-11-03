import { useState } from "react";
import useAuth from "../../shared/hooks/useAuth";
import AiMatchModal from "./AiMatchModal";
import BrowseJobs from "../../shared/components/BrowseJobs";
import { PageHeader } from "../../shared/components/dashboard";

function Jobs() {
  const { user } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);
  const skills = Array.isArray(user?.skills) ? user.skills : [];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="OPPORTUNITIES IN SANTA MARIA"
        title="Browse Verified Openings"
        subtitle="Search verified positions from accredited employers in Santa Maria."
      />

      <BrowseJobs
        jobHref={(id) => `/job-seeker/jobs/${id}`}
        initialSkills={skills.slice(0, 3)}
        toolbar={
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            aria-label="Open AI job matching"
            title="AI Job Matching"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold tracking-wide">AI</span>
          </button>
        }
      />

      <AiMatchModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

export default Jobs;
