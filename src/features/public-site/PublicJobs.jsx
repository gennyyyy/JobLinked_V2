import { useSearchParams } from "react-router-dom";
import SkipLink from "../../shared/components/SkipLink";
import PublicHeader from "../../shared/components/PublicHeader";
import PublicFooter from "../../shared/components/PublicFooter";
import BrowseJobs from "../../shared/components/BrowseJobs";

function PublicJobs() {
  const [searchParams] = useSearchParams();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <SkipLink />
      <PublicHeader />

      <main id="main-content" tabIndex={-1}
        className="flex-1 w-full p-[5%]">
        <div className="mb-8">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">PUBLIC EMPLOYMENT BULLETINS</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Find Openings in Santa Maria</h1>
          <p className="mt-3 text-sm md:text-base text-gray-500 max-w-2xl">Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal.</p>
        </div>

        {/* Remounting on the query string re-seeds the search fields from the URL. */}
        <BrowseJobs
          key={searchParams.toString()}
          jobHref={(id) => `/jobs/${id}`}
          initialKeyword={searchParams.get("keyword") || ""}
          initialLocation={searchParams.get("location") || ""}
        />
      </main>

      <PublicFooter />
    </div>
  );
}

export default PublicJobs;
