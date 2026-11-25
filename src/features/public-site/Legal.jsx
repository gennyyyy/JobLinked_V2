import { useEffect, useState } from "react";
import SkipLink from "../../shared/components/SkipLink";
import PublicShell from "../../shared/components/PublicShell";
import { PRIVACY_NOTICE, TERMS_OF_USE } from "../../shared/content/legal";
import { getLegal } from "../../shared/services/legal";
import { Skeleton } from "@/components/ui/skeleton";

const FALLBACKS = { privacy: PRIVACY_NOTICE, terms: TERMS_OF_USE };

function Legal({ title, document = "privacy" }) {
  const fallback = FALLBACKS[document] || PRIVACY_NOTICE;
  const [body, setBody] = useState(fallback);
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== document;

  useEffect(() => {
    let active = true;
    getLegal(document)
      .then((text) => {
        if (!active) return;
        setBody(text && String(text).trim() ? text : fallback);
        setLoadedFor(document);
      })
      .catch(() => {
        if (!active) return;
        setBody(fallback);
        setLoadedFor(document);
      });
    return () => {
      active = false;
    };
  }, [document, fallback]);

  return (
    <>
      <SkipLink />
      <PublicShell>
        <div className="page-container max-w-3xl py-12 md:py-16">
          <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-3xl">{title}</h1>
          {loading && <Skeleton className="mt-8 h-4 w-full" />}
          <div className="mt-8 whitespace-pre-line text-sm leading-7 text-muted-foreground">
            {body}
          </div>
        </div>
      </PublicShell>
    </>
  );
}

export default Legal;