import type { Metadata } from "next";
import { JobSearchApp } from "@/components/JobSearchApp";
import { buildGoogleAdPolicy } from "@/lib/ad-eligibility";
import { withManualAdSlotIds } from "@/lib/ad-policy-slots";
import { toClientJobs } from "@/lib/client-jobs";
import { filterJobs } from "@/lib/search";
import { buildHomeLanding, buildHomeLandingLinkGroups } from "@/lib/seo-landings";
import { selectSponsorSlots } from "@/lib/sponsors";
import { getLiveJobs, readSyncState } from "@/lib/store";
import type { WorkMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const jobs = await getLiveJobs();
  const landing = buildHomeLanding(jobs, filterJobs(jobs, {}).length);

  return {
    title: landing.metaTitle,
    description: landing.description,
    alternates: {
      canonical: "/"
    },
    robots: landing.indexable ? undefined : { index: false, follow: true }
  };
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ q?: string; location?: string; workMode?: string }> }) {
  const params = await searchParams;
  const initialQuery = cleanParam(params?.q);
  const initialLocation = cleanParam(params?.location);
  const initialWorkMode = cleanWorkMode(params?.workMode);
  const jobs = await getLiveJobs();
  const filtered = filterJobs(jobs, { query: initialQuery, location: initialLocation, workMode: initialWorkMode });
  const landing = buildHomeLanding(jobs, filtered.length);
  const sponsors = await selectSponsorSlots({ resultCount: filtered.length });
  const adPolicy = withManualAdSlotIds(buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: filtered.length,
    indexable: landing.indexable,
    syncState: await readSyncState()
  }));

  return (
    <JobSearchApp
      jobs={toClientJobs(filtered.slice(0, 100))}
      initialTotal={filtered.length}
      initialQuery={initialQuery}
      initialLocation={initialLocation}
      initialWorkMode={initialWorkMode}
      adPolicy={adPolicy}
      sponsors={sponsors}
      pageIntro={{
        title: landing.title,
        text: landing.text
      }}
      pageGuide={landing.guide}
      landingLinkGroups={buildHomeLandingLinkGroups(jobs)}
    />
  );
}

function cleanParam(value?: string) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function cleanWorkMode(value?: string): WorkMode | "all" {
  if (value === "remote" || value === "hybrid" || value === "onsite" || value === "unclear") return value;
  return "all";
}
