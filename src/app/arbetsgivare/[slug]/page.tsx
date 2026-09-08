import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import { getDisplayTitle } from "@/lib/job-title";
import { getApprovedEmployerProfile } from "@/lib/monetization-store";
import { getLiveJobs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getApprovedEmployerProfile(slug);
  if (!profile) return {};

  return {
    title: `${profile.employerName} | Arbetsgivare`,
    description: profile.summary,
    alternates: {
      canonical: `/arbetsgivare/${profile.slug}`
    }
  };
}

export default async function EmployerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getApprovedEmployerProfile(slug);
  if (!profile) notFound();

  const jobs = (await getLiveJobs())
    .filter((job) => job.employerName.toLowerCase() === profile.employerName.toLowerCase())
    .slice(0, 20);

  return (
    <main className="detail-shell">
      <div className="detail-topbar">
        <Link href="/" className="back-link"><ArrowLeft size={18} /> Till sökningen</Link>
        <span>Granskad arbetsgivarprofil</span>
      </div>

      <section className="detail-hero employer-profile-hero">
        <div>
          {profile.logoUrl ? <img className="employer-profile-logo" src={profile.logoUrl} alt="" /> : null}
          <h1>{profile.employerName}</h1>
          <p>{profile.summary}</p>
          {profile.websiteUrl ? (
            <a className="plain-link" href={profile.websiteUrl} rel="nofollow noopener noreferrer">
              Besök webbplats <ExternalLink size={15} />
            </a>
          ) : null}
        </div>
      </section>

      {profile.specialties.length ? (
        <section className="content-section">
          <h2>Områden</h2>
          <div className="tag-list">
            {profile.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}
          </div>
        </section>
      ) : null}

      <section className="content-section">
        <h2>Publicerade jobb</h2>
        {jobs.length ? (
          <div className="related-jobs">
            {jobs.map((job) => (
              <Link href={`/jobb/${job.id}`} key={job.id}>
                <strong>{getDisplayTitle(job)}</strong>
                <span><MapPin size={14} /> {job.municipality}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p>Inga publicerade jobb hittades för den här arbetsgivaren just nu.</p>
        )}
      </section>

      <section className="content-section">
        <h2>Integritet</h2>
        <p>
          Profilen innehåller godkänd publik företagsinformation. Job Search Demo tar inte emot ansökningar,
          CV:n eller kandidatmeddelanden.
        </p>
      </section>
    </main>
  );
}
