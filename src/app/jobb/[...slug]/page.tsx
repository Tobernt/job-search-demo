import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, ExternalLink, Flag, MapPin } from "lucide-react";
import { JobSearchApp } from "@/components/JobSearchApp";
import { ReportForm } from "@/components/ReportForm";
import { buildGoogleAdPolicy } from "@/lib/ad-eligibility";
import { withManualAdSlotIds } from "@/lib/ad-policy-slots";
import { toClientJobs } from "@/lib/client-jobs";
import { formatSwedishDate } from "@/lib/date-format";
import { formatApplyType, formatEmployerType, formatEmploymentExtent, formatWorkMode } from "@/lib/format";
import { getCanonicalTitleNote, getDisplayTitle } from "@/lib/job-title";
import { getJobExplanations } from "@/lib/search";
import { buildRoleLocationLanding, buildRoleLocationLandingLinkGroups } from "@/lib/seo-landings";
import { normalizeSiteUrl } from "@/lib/site-url";
import { labelToSlug, slugToLabel } from "@/lib/slugs";
import { selectSponsorSlots } from "@/lib/sponsors";
import { findJob, getLiveJobs, readSyncState } from "@/lib/store";
import { findApprovedEmployerProfileForJob } from "@/lib/monetization-store";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  if (slug.length === 2) {
    const roleLabel = slugToLabel(slug[0]);
    const locationLabel = slugToLabel(slug[1]);
    const jobs = await getLiveJobs();
    const landing = buildRoleLocationLanding(jobs, roleLabel, locationLabel);

    return {
      title: landing.metaTitle,
      description: landing.description,
      alternates: {
        canonical: `/jobb/${labelToSlug(roleLabel)}/${labelToSlug(locationLabel)}`
      },
      robots: landing.indexable ? undefined : { index: false, follow: true }
    };
  }

  const job = slug.length === 1 ? await findJob(slug[0]) : undefined;
  if (!job) return {};

  if (job.status !== "live" || job.applyLinkStatus === "failed" || isExpired(job.applicationDeadline)) {
    return {
      title: `Jobbet har löpt ut | ${getDisplayTitle(job)}`,
      description: "Detta jobb är inte längre aktivt. Se liknande publicerade jobb i stället.",
      robots: { index: false, follow: true }
    };
  }

  return {
    title: `Ledigt jobb: ${getDisplayTitle(job)} hos ${job.employerName}`,
    description: job.plainSummary,
    alternates: {
      canonical: `/jobb/${job.id}`
    },
    robots: { index: false, follow: true }
  };
}

export default async function JobSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  if (slug.length === 2) {
    const roleLabel = slugToLabel(slug[0]);
    const locationLabel = slugToLabel(slug[1]);
    const jobs = await getLiveJobs();
    const landing = buildRoleLocationLanding(jobs, roleLabel, locationLabel);
    const filtered = landing.jobs;
    const sponsors = await selectSponsorSlots({ category: roleLabel, location: locationLabel, resultCount: filtered.length });
    const adPolicy = withManualAdSlotIds(buildGoogleAdPolicy({
      route: "role_location",
      visibleJobCount: filtered.length,
      indexable: landing.indexable,
      syncState: await readSyncState()
    }));

    return (
      <JobSearchApp
        jobs={toClientJobs(filtered.slice(0, 100))}
        initialTotal={filtered.length}
        initialQuery={roleLabel}
        initialLocation={locationLabel}
        adPolicy={adPolicy}
        sponsors={sponsors}
        pageIntro={{
          title: landing.title,
          text: landing.text
        }}
        pageGuide={landing.guide}
        landingLinkGroups={buildRoleLocationLandingLinkGroups(jobs, roleLabel, locationLabel)}
      />
    );
  }

  if (slug.length !== 1) notFound();

  const job = await findJob(slug[0]);
  if (!job) notFound();

  if (job.status !== "live" || job.applyLinkStatus === "failed" || isExpired(job.applicationDeadline)) {
    const liveJobs = await getLiveJobs();
    const related = liveJobs
      .filter((candidate) => candidate.id !== job.id)
      .filter((candidate) => candidate.titleCategory === job.titleCategory || candidate.municipality === job.municipality)
      .slice(0, 12);
    return <ExpiredJobPage job={job} related={related} />;
  }

  const explanations = getJobExplanations(job);
  const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);
  const employerProfile = await findApprovedEmployerProfileForJob(job);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: {
      "@type": "PropertyValue",
      name: job.employerName,
      value: job.sourceAdId || job.id
    },
    title: job.title,
    description: job.descriptionText || job.plainSummary,
    url: `${siteUrl}/jobb/${job.id}`,
    datePosted: job.publicationDate,
    validThrough: job.applicationDeadline,
    employmentType: toSchemaEmploymentType(job),
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: job.employerName,
      logo: job.logoUrl
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: job.workplaceAddress,
        addressLocality: job.municipality,
        addressRegion: job.region,
        addressCountry: "SE"
      }
    },
    ...(job.workMode === "remote"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: "Sverige"
          }
        }
      : {})
  };

  return (
    <main className="detail-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="detail-topbar">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} /> Till sökningen
        </Link>
        <span>Senast kontrollerad {formatSwedishDate(job.lastCheckedAt)}</span>
      </div>

      <section className="detail-hero">
        <div>
          <h1>{getDisplayTitle(job)}</h1>
          {getCanonicalTitleNote(job) ? <p className="original-title">Matchad roll: {getCanonicalTitleNote(job)}</p> : null}
          <div className="detail-meta">
            <span><Building2 size={16} /> {job.employerName}</span>
            <span><MapPin size={16} /> {job.municipality}</span>
            {employerProfile ? <Link href={`/arbetsgivare/${employerProfile.slug}`}>Arbetsgivarprofil</Link> : null}
          </div>
        </div>
        <a href={`/apply/${job.id}`} className="apply-button" rel="nofollow">
          Gå till ansökningssidan <ExternalLink size={18} />
        </a>
      </section>

      {job.workModeWarning ? (
        <div className="warning-band">
          <AlertTriangle size={18} />
          {job.workModeWarning}
        </div>
      ) : null}

      <section className="fact-grid">
        <Fact label="Arbetsform" value={formatWorkMode(job.workMode)} />
        <Fact label="Omfattning" value={job.employmentTypeText ?? formatEmploymentExtent(job.employmentExtent)} />
        <Fact label="Annonsör" value={formatEmployerType(job.employerType)} />
        <Fact label="Lön" value={job.salaryText} />
        <Fact label="Språk" value={job.languageLabels.join(", ")} />
        <Fact label="Erfarenhet" value={formatSeniority(job.seniority)} />
        <Fact label="Ansök senast" value={formatSwedishDate(job.applicationDeadline)} />
        <Fact label="Förtroende" value={`${job.trustScore ?? 50}/100`} />
      </section>

      <section className="detail-layout">
        <article className="detail-main">
          <Section title="Vad du faktiskt gör">
            <p>{job.plainSummary}</p>
          </Section>

          <Section title="Krav">
            <BulletList items={job.mustHaveSummary} fallback="Inga tydliga krav hittades i annonsen." />
          </Section>

          <Section title="Meriterande">
            <BulletList items={job.niceToHaveSummary} fallback="Inga meriterande krav hittades i annonsen." />
          </Section>

          <Section title="Varför visas detta?">
            <BulletList items={explanations} fallback="Inga särskilda anmärkningar." />
          </Section>

          <Section title="Originaltext">
            <p className="original-text">{job.descriptionText || "Originaltext saknas."}</p>
          </Section>
        </article>

        <aside className="detail-side">
          <div className="side-panel">
            <h2>Ansökan</h2>
            <p>Du lämnar Job Search Demo och går vidare till källans ansökningssida.</p>
            <dl>
              <div><dt>Destination</dt><dd>{job.applyDomain || "Okänd"}</dd></div>
              <div><dt>Typ</dt><dd>{formatApplyType(job.applyType)}</dd></div>
              <div><dt>Länkstatus</dt><dd>{formatApplyLinkStatus(job.applyLinkStatus)}</dd></div>
            </dl>
            <a href={`/apply/${job.id}`} className="apply-button full-width" rel="nofollow">
              Gå till ansökningssidan <ExternalLink size={18} />
            </a>
          </div>

          <div className="side-panel">
            <h2><Flag size={18} /> Rapportera</h2>
            <ReportForm jobId={job.id} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function ExpiredJobPage({ job, related }: { job: Job; related: Job[] }) {
  return (
    <main className="detail-shell">
      <div className="detail-topbar">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} /> Till sökningen
        </Link>
        <span>Utgången annons</span>
      </div>
      <section className="detail-hero">
        <div>
          <h1>Detta jobb har löpt ut</h1>
          <p className="original-title">{getDisplayTitle(job)} hos {job.employerName}</p>
          <div className="detail-meta">
            <span><MapPin size={16} /> {job.municipality}</span>
          </div>
        </div>
        <Link href={`/jobb/${labelToSlug(getDisplayTitle(job))}/${labelToSlug(job.municipality)}`} className="apply-button">
          Se liknande jobb
        </Link>
      </section>
      <section className="content-section">
        <h2>Publicerade alternativ</h2>
        {related.length ? (
          <div className="related-jobs">
            {related.map((candidate) => (
              <Link href={`/jobb/${candidate.id}`} key={candidate.id}>
                <strong>{getDisplayTitle(candidate)}</strong>
                <span>{candidate.employerName} · {candidate.municipality}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p>Inga liknande jobb hittades just nu.</p>
        )}
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value || "Ej angivet"}</strong>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="content-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function BulletList({ items, fallback }: { items: string[]; fallback: string }) {
  if (!items.length) return <p>{fallback}</p>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function formatSeniority(value: string) {
  return {
    junior: "Junior",
    medior: "Medior",
    senior: "Senior",
    lead: "Lead/chef",
    unclear: "Oklar"
  }[value] ?? "Oklar";
}

function formatApplyLinkStatus(value: string) {
  return {
    unchecked: "Inte kontrollerad",
    ok: "Kontrollerad",
    failed: "Behover kontrolleras"
  }[value] ?? "Inte kontrollerad";
}

function isExpired(value?: string) {
  if (!value) return false;
  const deadline = new Date(value);
  return Number.isFinite(deadline.getTime()) && deadline < new Date();
}

function toSchemaEmploymentType(job: Job) {
  if (job.employmentExtent === "full_time") return "FULL_TIME";
  if (job.employmentExtent === "part_time") return "PART_TIME";
  if (job.employmentExtent === "mixed") return ["FULL_TIME", "PART_TIME"];
  return undefined;
}
