import type { Metadata } from "next";
import { JobSearchApp } from "@/components/JobSearchApp";
import { buildGoogleAdPolicy } from "@/lib/ad-eligibility";
import { withManualAdSlotIds } from "@/lib/ad-policy-slots";
import { toClientJobs } from "@/lib/client-jobs";
import { buildHomeLandingLinkGroups, buildRemoteLanding } from "@/lib/seo-landings";
import { selectSponsorSlots } from "@/lib/sponsors";
import { getLiveJobs, readSyncState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const jobs = await getLiveJobs();
  const landing = buildRemoteLanding(jobs);

  return {
    title: landing.metaTitle,
    description: landing.description,
    alternates: {
      canonical: "/distansjobb"
    },
    robots: landing.indexable ? undefined : { index: false, follow: true }
  };
}

export default async function RemoteJobsPage() {
  const jobs = await getLiveJobs();
  const landing = buildRemoteLanding(jobs);
  const filtered = landing.jobs;
  const sponsors = await selectSponsorSlots({ workMode: "remote", resultCount: filtered.length });
  const adPolicy = withManualAdSlotIds(buildGoogleAdPolicy({
    route: "remote",
    visibleJobCount: filtered.length,
    indexable: landing.indexable,
    syncState: await readSyncState()
  }));
  return (
    <JobSearchApp
      jobs={toClientJobs(filtered.slice(0, 100))}
      initialTotal={filtered.length}
      initialWorkMode="remote"
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
