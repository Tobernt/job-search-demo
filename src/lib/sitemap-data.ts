import { normalizeSiteUrl as normalizeConfiguredSiteUrl } from "@/lib/site-url";
import { listEmployerProfiles } from "@/lib/monetization-store";
import { getLiveJobs } from "@/lib/store";
import { getIndexableMunicipalityTargets, getIndexableRoleLocationTargets, getIndexableRoleTargets } from "@/lib/seo-landings";

export const jobSitemapPageSize = 45_000;

export interface SitemapUrl {
  url: string;
  lastModified?: Date;
}

export interface SitemapSection {
  url: string;
  lastModified?: Date;
}

export async function getSitemapSections(siteUrl: string): Promise<SitemapSection[]> {
  const jobs = await getLiveJobs();
  const latestJobUpdate = getLatestJobUpdate(jobs);
  const municipalityTargets = getIndexableMunicipalityTargets(jobs);
  const roleTargets = getIndexableRoleTargets(jobs);
  const roleLocationTargets = getIndexableRoleLocationTargets(jobs);

  return [
    { url: `${siteUrl}/sitemaps/static.xml`, lastModified: latestJobUpdate },
    ...(municipalityTargets.length ? [{ url: `${siteUrl}/sitemaps/municipalities.xml`, lastModified: latestJobUpdate }] : []),
    ...(roleTargets.length ? [{ url: `${siteUrl}/sitemaps/roles.xml`, lastModified: latestJobUpdate }] : []),
    ...(roleLocationTargets.length ? [{ url: `${siteUrl}/sitemaps/role-locations.xml`, lastModified: latestJobUpdate }] : [])
  ];
}

export async function getStaticSitemapUrls(siteUrl: string): Promise<SitemapUrl[]> {
  const jobs = await getLiveJobs();
  const visibleJobs = jobs.filter(isDefaultVisibleJob);
  const remoteJobs = visibleJobs.filter((job) => job.workMode === "remote");
  const latestJobUpdate = getLatestJobUpdate(jobs);

  return [
    { url: siteUrl, lastModified: latestJobUpdate },
    { url: `${siteUrl}/distansjobb`, lastModified: getLatestJobUpdate(remoteJobs) ?? latestJobUpdate },
    { url: `${siteUrl}/cookieinstallningar` },
    { url: `${siteUrl}/integritet` },
    { url: `${siteUrl}/villkor` },
    { url: `${siteUrl}/annonser` },
    ...(await getEmployerProfileUrls(siteUrl))
  ];
}

export async function getMunicipalitySitemapUrls(siteUrl?: string): Promise<SitemapUrl[]> {
  const baseUrl = siteUrl ?? "";
  return getIndexableMunicipalityTargets(await getLiveJobs()).map((target) => ({
    url: `${baseUrl}${target.href}`,
    lastModified: target.lastModified
  }));
}

export async function getRoleLocationSitemapUrls(siteUrl?: string): Promise<SitemapUrl[]> {
  const baseUrl = siteUrl ?? "";
  return getIndexableRoleLocationTargets(await getLiveJobs()).map((target) => ({
    url: `${baseUrl}${target.href}`,
    lastModified: target.lastModified
  }));
}

export async function getRoleSitemapUrls(siteUrl?: string): Promise<SitemapUrl[]> {
  const baseUrl = siteUrl ?? "";
  return getIndexableRoleTargets(await getLiveJobs()).map((target) => ({
    url: `${baseUrl}${target.href}`,
    lastModified: target.lastModified
  }));
}

export async function getJobSitemapUrls(siteUrl?: string, page?: number): Promise<SitemapUrl[]> {
  void siteUrl;
  void page;
  return [];
}

export function normalizeSiteUrl(value?: string) {
  return normalizeConfiguredSiteUrl(value);
}

function getLatestJobUpdate(jobs: Array<{ updatedAt?: string; publicationDate?: string }>) {
  return jobs.reduce<Date | undefined>((latest, job) => {
    return laterDate(latest, parseDate(job.updatedAt ?? job.publicationDate));
  }, undefined);
}

function isDefaultVisibleJob(job: { salesNoise?: boolean; employerType?: string }) {
  return !job.salesNoise && job.employerType !== "recruiter" && job.employerType !== "staffing_agency";
}

function laterDate(a?: Date, b?: Date) {
  if (!a) return b;
  if (!b) return a;
  return b > a ? b : a;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

async function getEmployerProfileUrls(siteUrl: string): Promise<SitemapUrl[]> {
  return (await listEmployerProfiles())
    .filter((profile) => profile.status === "approved")
    .map((profile) => ({
      url: `${siteUrl}/arbetsgivare/${profile.slug}`,
      lastModified: parseDate(profile.updatedAt)
    }));
}
