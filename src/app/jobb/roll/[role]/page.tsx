import type { Metadata } from "next";
import { JobSearchApp } from "@/components/JobSearchApp";
import { buildGoogleAdPolicy } from "@/lib/ad-eligibility";
import { withManualAdSlotIds } from "@/lib/ad-policy-slots";
import { toClientJobs } from "@/lib/client-jobs";
import { buildRoleLanding, buildRoleLandingLinkGroups } from "@/lib/seo-landings";
import { labelToSlug, slugToLabel } from "@/lib/slugs";
import { selectSponsorSlots } from "@/lib/sponsors";
import { getLiveJobs, readSyncState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role } = await params;
  const label = slugToLabel(role);
  const jobs = await getLiveJobs();
  const landing = buildRoleLanding(jobs, label);

  return {
    title: landing.metaTitle,
    description: landing.description,
    alternates: {
      canonical: `/jobb/roll/${labelToSlug(label)}`
    }
  };
}

export default async function RoleJobsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  const label = slugToLabel(role);
  const jobs = await getLiveJobs();
  const landing = buildRoleLanding(jobs, label);
  const filtered = landing.jobs;
  const sponsors = await selectSponsorSlots({ category: label, resultCount: filtered.length });
  const adPolicy = withManualAdSlotIds(buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: filtered.length,
    indexable: true,
    syncState: await readSyncState()
  }));

  return (
    <JobSearchApp
      jobs={toClientJobs(filtered.slice(0, 100))}
      initialTotal={filtered.length}
      initialQuery={label}
      adPolicy={adPolicy}
      sponsors={sponsors}
      pageIntro={{
        title: landing.title,
        text: landing.text
      }}
      pageGuide={landing.guide}
      landingLinkGroups={buildRoleLandingLinkGroups(jobs, label)}
    />
  );
}
