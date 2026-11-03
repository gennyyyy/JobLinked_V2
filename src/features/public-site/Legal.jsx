import SkipLink from "../../shared/components/SkipLink";
import PublicShell from "../../shared/components/PublicShell";
import { TERMS_PLACEHOLDER } from "../../shared/components/TermsModal";

// One document covers both the data-collection terms and the PESO privacy
// policy, so /privacy and /terms render the same body with different headings.
function Legal({ title }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <SkipLink />
      <PublicShell>
        <main id="main-content" className="page-container max-w-3xl py-14">
          <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-3xl">{title}</h1>
          <div className="mt-8 whitespace-pre-line text-sm leading-7 text-muted-foreground">{TERMS_PLACEHOLDER}</div>
        </main>
      </PublicShell>
    </div>
  );
}

export default Legal;
