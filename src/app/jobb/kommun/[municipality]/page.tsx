import type { Metadata } from "next";
import { JobSearchApp } from "@/components/JobSearchApp";
import { buildGoogleAdPolicy } from "@/lib/ad-eligibility";
import { withManualAdSlotIds } from "@/lib/ad-policy-slots";
import { toClientJobs } from "@/lib/client-jobs";
import { buildMunicipalityLanding, buildMunicipalityLandingLinkGroups } from "@/lib/seo-landings";
import { slugToLabel } from "@/lib/slugs";
import { selectSponsorSlots } from "@/lib/sponsors";
import { getLiveJobs, readSyncState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ municipality: string }> }): Promise<Metadata> {
  const { municipality } = await params;
  const label = slugToLabel(municipality);
  const jobs = await getLiveJobs();
  const landing = buildMunicipalityLanding(jobs, label);

  return {
    title: landing.metaTitle,
    description: landing.description,
    alternates: {
      canonical: `/jobb/kommun/${municipality}`
    },
    robots: landing.indexable ? undefined : { index: false, follow: true }
  };
}

export default async function MunicipalityJobsPage({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const label = slugToLabel(municipality);
  const jobs = await getLiveJobs();
  const landing = buildMunicipalityLanding(jobs, label);
  const filtered = landing.jobs;
  const sponsors = await selectSponsorSlots({ location: label, resultCount: filtered.length });
  const adPolicy = withManualAdSlotIds(buildGoogleAdPolicy({
    route: "municipality",
    visibleJobCount: filtered.length,
    indexable: landing.indexable,
    syncState: await readSyncState()
  }));

  return (
    <JobSearchApp
      jobs={toClientJobs(filtered.slice(0, 100))}
      initialTotal={filtered.length}
      initialLocation={label}
      adPolicy={adPolicy}
      sponsors={sponsors}
      pageIntro={{
        title: landing.title,
        text: landing.text
      }}
      pageGuide={landing.guide}
      landingLinkGroups={buildMunicipalityLandingLinkGroups(jobs, label)}
    />
  );
}
