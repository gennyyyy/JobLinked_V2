import SkipLink from "../../shared/components/SkipLink";
import PublicShell from "../../shared/components/PublicShell";
import { PRIVACY_NOTICE, TERMS_OF_USE } from "../../shared/content/legal";

// Two separate documents (G2): the privacy notice and the terms of use. They used
// to share one placeholder body; the copy now lives in shared/content/legal.js so
// the footer links, this page, and the registration consent modal stay in sync.
const DOCUMENTS = {
  privacy: PRIVACY_NOTICE,
  terms: TERMS_OF_USE,
};

function Legal({ title, document = "privacy" }) {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <div className="page-container max-w-3xl py-14">
          <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-3xl">{title}</h1>
          <div className="mt-8 whitespace-pre-line text-sm leading-7 text-muted-foreground">
            {DOCUMENTS[document] || PRIVACY_NOTICE}
          </div>
        </div>
      </PublicShell>
    </>
  );
}

export default Legal;
