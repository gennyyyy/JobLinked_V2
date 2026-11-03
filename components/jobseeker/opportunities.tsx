"use client";

import { useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import {
  PageHeading,
  LinkButton,
  Notice,
  EmptyState,
} from "@/components/shared";
import { JobCard } from "@/components/jobs/job-card";
import { PreferenceMatching, preferenceScore } from "@/components/jobs/preference-matching";
import {
  ListPagination,
  SearchInput,
} from "@/components/dashboard/list-controls";
import { useDemo } from "@/hooks/use-demo";
import { isJobOpen, matchJob } from "@/lib/format";

const BROWSE_JOBS_PAGE_SIZE = 15;

export function JobSeekerOpportunities({ saved = false }: { saved?: boolean }) {
  const { state, seeker } = useDemo();
  const [query, setQuery] = useState("");
  const [matchingPrompt, setMatchingPrompt] = useState("");
  const [page, setPage] = useState(1);
  if (!seeker) return null;
  const jobs = state.jobs
    .filter((j) =>
      saved
        ? seeker.savedJobIds.includes(j.id)
        : isJobOpen(j) &&
          state.employers.some(
            (e) =>
              e.id === j.employerId && e.accreditationStatus === "Approved",
          ),
    )
    .filter((j) =>
      `${j.title} ${state.employers.find((e) => e.id === j.employerId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      saved
        ? b.postedAt.localeCompare(a.postedAt)
        : (matchingPrompt ? preferenceScore(b, matchingPrompt) - preferenceScore(a, matchingPrompt) : 0) || matchJob(b, seeker).score - matchJob(a, seeker).score,
    );
  const currentPage = saved
    ? 1
    : Math.min(
        page,
        Math.max(1, Math.ceil(jobs.length / BROWSE_JOBS_PAGE_SIZE)),
      );
  const visibleJobs = saved
    ? jobs
    : jobs.slice(
        (currentPage - 1) * BROWSE_JOBS_PAGE_SIZE,
        currentPage * BROWSE_JOBS_PAGE_SIZE,
      );
  return (
    <>
      <PageHeading
        eyebrow={saved ? "Your collection" : "Built around your skills"}
        title={
          saved
            ? "Keep good opportunities close."
            : "Browse Jobs"
        }
        description={
          saved
            ? "Your saved vacancies, together in one place. Closed roles may no longer accept applications."
            : "Explore local roles ranked by the skills you have added to your profile."
        }
        action={
          <LinkButton href="/jobs" variant="outline">
            <BriefcaseBusiness data-icon="inline-start" />
            Browse all jobs
          </LinkButton>
        }
      />
      {!saved && (
        <PreferenceMatching
          prompt={matchingPrompt}
          onSubmit={(prompt) => {
            setMatchingPrompt(prompt);
            setPage(1);
          }}
        />
      )}
      {!saved && (
        <div className="mb-6">
          <Notice title="A match you can understand">
            Skills overlap is the number of your exact, case-insensitive skill
            matches divided by the skills listed in the vacancy. It is not AI, a
            hiring score, or a guarantee. Add skills in My Profile to update
            your recommendations.
          </Notice>
        </div>
      )}
      <div className="mb-5 max-w-lg">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={
            saved
              ? "Search saved opportunities…"
              : "Search your recommendations…"
          }
        />
      </div>
      <p className="mb-4 text-xs text-muted-foreground" aria-live="polite">
        {jobs.length}{" "}
        {saved ? "saved opportunities" : "matching vacancies"}
      </p>
      {jobs.length ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleJobs.map((job) => (
            <JobCard key={job.id} job={job} showMatch={!saved} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            saved
              ? "Make room for your next chapter."
              : "No matching opportunities in this view."
          }
          description={
            saved
              ? "Tap the bookmark on a vacancy to save it here, or clear your search."
              : "Try another search or explore all local vacancies."
          }
          href="/jobs"
        />
      )}
      {!saved && jobs.length > 0 && (
        <ListPagination
          total={jobs.length}
          page={currentPage}
          onChange={setPage}
          pageSize={BROWSE_JOBS_PAGE_SIZE}
        />
      )}
    </>
  );
}
