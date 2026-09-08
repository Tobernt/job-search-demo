"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { addId, readLocalJobState, writeLocalJobState } from "@/lib/local-job-state";

export function ApplyRedirect({
  jobId,
  applyUrl,
  title
}: {
  jobId: string;
  applyUrl: string;
  title: string;
}) {
  function handleContinue() {
    const state = readLocalJobState();
    writeLocalJobState({
      ...state,
      viewed: addId(state.viewed, jobId),
      applied: addId(state.applied, jobId)
    });

    fetch("/api/apply-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId }),
      keepalive: true
    }).catch(() => undefined);
  }

  if (jobId.startsWith("demo-")) {
    return <main className="apply-redirect"><h1>Demoannons</h1><p>{title}</p><p>Annonsen är påhittad. Det finns ingen verklig ansökningssida.</p><Link href="/">Till sökningen</Link></main>;
  }

  return (
    <main className="apply-redirect">
      <div>
        <span className="status-check">✓</span>
        <h1>Vidare till ansökan</h1>
        <p>{title}</p>
        <p>
          Du lämnar nu Job Search Demo och går vidare till den externa ansökningssidan.
          Ansökan hanteras av arbetsgivaren, rekryteraren eller källan bakom jobbannonsen.
        </p>
        <p className="apply-disclosure">
          Jobbrankingen säljs inte och Job Search Demo tar inte emot CV:n, ansökningar eller kandidatmeddelanden.
        </p>
        <a href={applyUrl} rel="nofollow" onClick={handleContinue}>
          Fortsätt till ansökningssidan <ExternalLink size={18} />
        </a>
        <Link className="plain-link" href="/annonser">Annons- och transparenspolicy</Link>
      </div>
    </main>
  );
}
