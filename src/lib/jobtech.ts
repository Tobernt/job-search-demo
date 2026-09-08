import crypto from "node:crypto";
import {
  CLASSIFICATION_VERSION,
  classifyApplyType,
  classifyEmployerType,
  classifySalesNoise,
  classifySeniority,
  classifyWorkMode,
  extractLanguages,
  extractRequirementLines,
  extractSalary,
  makePlainSummary,
  normalizeText
} from "./classifiers";
import type { Job, JobTechAd } from "./types";
import { canonicalizeTitle } from "./title-normalizer";

const JOBSEARCH_URL = process.env.JOBSEARCH_API_URL ?? "";
const JOBSTREAM_URL = process.env.JOBSTREAM_API_URL ?? "";

export async function fetchJobSearchAds(limit = 80, offset = 0): Promise<JobTechAd[]> {
  const url = new URL(JOBSEARCH_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`JobSearch failed: ${response.status}`);

  const payload = await response.json();
  return payload.hits ?? [];
}

export async function fetchJobStreamAds(from: Date): Promise<JobTechAd[]> {
  const url = new URL(JOBSTREAM_URL);
  url.searchParams.set("date", from.toISOString().slice(0, 19));

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`JobStream failed: ${response.status}`);
  return await response.json();
}

export function isRemoved(ad: JobTechAd): boolean {
  return Boolean(ad.removed || ad.removed_date);
}

export function isSwedishJob(ad: JobTechAd): boolean {
  const country = normalizeText(ad.workplace_address?.country);
  const countryCode = String(ad.workplace_address?.country_code ?? "").toLowerCase();
  const municipality = ad.workplace_address?.municipality;
  const region = ad.workplace_address?.region;

  if (["sverige", "sweden", "se"].includes(country)) return true;
  if (["199", "se"].includes(countryCode)) return true;
  if (municipality || region) return true;

  const text = `${ad.employer?.name ?? ""} ${ad.description?.text ?? ""}`;
  return /sverige|sweden|stockholm|göteborg|goteborg|malmö|malmo/i.test(text);
}

export function normalizeJobTechAd(ad: JobTechAd): Job {
  const sourceAdId = String(ad.id);
  const descriptionText = ad.description?.text ?? "";
  const title = ad.headline?.trim() || "Titel saknas";
  const employerName = ad.employer?.name?.trim() || "Arbetsgivare saknas";
  const employerType = classifyEmployerType(ad);
  const applyUrl = ad.application_details?.url || ad.webpage_url || "";
  const workMode = classifyWorkMode(descriptionText, ad.webpage_url);
  const employment = classifyEmploymentExtent(ad);
  const canonicalTitle = canonicalizeTitle(ad);
  const publicationDate = ad.publication_date ?? ad.timestamp ?? new Date().toISOString();
  const now = new Date().toISOString();
  const applyType = classifyApplyType(applyUrl, employerType);
  const applyDomain = getDomain(applyUrl);
  const employerVerified = verifyEmployerSignal(employerName, applyDomain, employerType, applyType, ad.employer?.organization_number);
  const trustScore = calculateTrustScore({
    employerType,
    employerVerified: employerVerified.verified,
    applyUrl,
    applyType,
    workModeConfidence: workMode.confidence,
    salaryText: extractSalary(ad),
    mustHaveCount: extractRequirementLines(ad, "must").length,
    niceToHaveCount: extractRequirementLines(ad, "nice").length,
    salesNoise: classifySalesNoise(title, descriptionText)
  });
  const salaryText = extractSalary(ad);
  const mustHaveSummary = extractRequirementLines(ad, "must");
  const niceToHaveSummary = extractRequirementLines(ad, "nice");
  const salesNoise = classifySalesNoise(title, descriptionText);

  return {
    id: stableId("jobtech", sourceAdId),
    source: "jobtech",
    sourceAdId,
    sourceUrl: ad.webpage_url ?? "",
    logoUrl: ad.logo_url,
    title,
    titleNormalized: normalizeTitle(title),
    titleCanonical: canonicalTitle.canonicalTitle,
    titleCategory: canonicalTitle.titleCategory,
    employerName,
    employerOrganizationNumber: ad.employer?.organization_number,
    workplaceName: ad.employer?.workplace,
    workplaceAddress: buildWorkplaceAddress(ad),
    municipality: ad.workplace_address?.municipality ?? "Okänd ort",
    region: ad.workplace_address?.region ?? "",
    country: ad.workplace_address?.country ?? "Sverige",
    publicationDate,
    applicationDeadline: ad.application_deadline,
    status: isRemoved(ad) ? "removed" : "live",
    employerType,
    employmentExtent: employment.extent,
    employmentTypeText: employment.label,
    scopeMin: employment.scopeMin,
    scopeMax: employment.scopeMax,
    salesNoise,
    workMode: workMode.mode,
    workModeConfidence: workMode.confidence,
    workModeWarning: workMode.warning,
    seniority: classifySeniority(title, descriptionText),
    salaryText,
    languageLabels: extractLanguages(ad, descriptionText),
    mustHaveSummary,
    niceToHaveSummary,
    plainSummary: makePlainSummary(ad),
    descriptionText,
    applyUrl,
    applyDomain,
    applyType,
    applyLinkStatus: "unchecked",
    employerVerified: employerVerified.verified,
    employerVerificationReason: employerVerified.reason,
    trustScore,
    canonicalFingerprint: createCanonicalFingerprint({
      employerName,
      applyUrl,
      title: canonicalTitle.canonicalTitle || title,
      municipality: ad.workplace_address?.municipality ?? "",
      deadline: ad.application_deadline,
      descriptionText
    }),
    lastCheckedAt: now,
    firstSeenAt: publicationDate,
    updatedAt: now,
    classificationVersion: CLASSIFICATION_VERSION
  };
}

export function normalizeTitle(title: string) {
  return title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function buildWorkplaceAddress(ad: JobTechAd) {
  const address = ad.workplace_address;
  if (!address) return undefined;

  const parts = [
    address.street_address,
    address.postcode,
    address.city,
    address.municipality,
    address.region,
    address.country ?? "Sverige"
  ].filter((part): part is string => Boolean(part?.trim()));

  return Array.from(new Set(parts)).join(", ") || undefined;
}

function verifyEmployerSignal(
  employerName: string,
  applyDomain: string,
  employerType: string,
  applyType: string,
  organizationNumber?: string
) {
  if (!employerName || employerType !== "direct_employer") {
    return { verified: false, reason: "Annonsören är inte klassad som direkt arbetsgivare." };
  }

  if (organizationNumber) {
    return { verified: true, reason: "Direkt arbetsgivare med organisationsnummer i källan." };
  }

  if (applyType === "via_af") {
    return { verified: true, reason: "Publicerad via Platsbanken med direkt arbetsgivare i källan." };
  }

  if (applyType === "employer_site" && applyDomain && domainLooksLikeEmployer(employerName, applyDomain)) {
    return { verified: true, reason: "Ansökningsdomänen matchar arbetsgivarsignalen." };
  }

  if (applyType === "ats" && applyDomain) {
    return { verified: true, reason: "Direkt arbetsgivare med känt rekryteringssystem som ansökningsdestination." };
  }

  return { verified: false, reason: "Ansökningsdestinationen kunde inte verifieras automatiskt." };
}

function domainLooksLikeEmployer(employerName: string, applyDomain: string) {
  const domain = normalizeText(applyDomain.replace(/\.(se|com|nu|io|org|net)$/i, ""));
  const employerTokens = normalizeText(employerName)
    .split(" ")
    .filter((token) => token.length >= 4 && !["ab", "jobb", "sverige", "sweden"].includes(token));
  return employerTokens.some((token) => domain.includes(token));
}

function calculateTrustScore(input: {
  employerType: string;
  employerVerified: boolean;
  applyUrl: string;
  applyType: string;
  workModeConfidence: number;
  salaryText: string;
  mustHaveCount: number;
  niceToHaveCount: number;
  salesNoise: boolean;
}) {
  let score = 50;
  if (input.employerVerified) score += 18;
  if (input.applyUrl) score += 10;
  if (["employer_site", "ats", "via_af"].includes(input.applyType)) score += 8;
  if (input.employerType === "direct_employer") score += 8;
  if (input.employerType === "recruiter" || input.employerType === "staffing_agency") score -= 14;
  if (input.workModeConfidence >= 0.8) score += 8;
  if (input.salaryText && !/l[oö]n ej angiven/i.test(input.salaryText)) score += 7;
  if (input.mustHaveCount) score += 6;
  if (input.niceToHaveCount) score += 3;
  if (input.salesNoise) score -= 16;
  return Math.max(0, Math.min(100, score));
}

function createCanonicalFingerprint(input: {
  employerName: string;
  applyUrl: string;
  title: string;
  municipality: string;
  deadline?: string;
  descriptionText: string;
}) {
  const urlKey = normalizeApplyUrlForFingerprint(input.applyUrl);
  const descriptionKey = normalizeText(input.descriptionText).slice(0, 180);
  return crypto
    .createHash("sha1")
    .update([
      normalizeText(input.employerName),
      normalizeText(input.title),
      normalizeText(input.municipality),
      input.deadline ?? "",
      urlKey,
      descriptionKey
    ].join("|"))
    .digest("hex")
    .slice(0, 24);
}

function normalizeApplyUrlForFingerprint(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|mc_|ref|source)$/i.test(key)) url.searchParams.delete(key);
    }
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return "";
  }
}

function stableId(source: string, sourceAdId: string) {
  return crypto.createHash("sha1").update(`${source}:${sourceAdId}`).digest("hex").slice(0, 24);
}

function classifyEmploymentExtent(ad: JobTechAd) {
  const label = ad.working_hours_type?.label ?? ad.employment_type?.label ?? "";
  const min = ad.scope_of_work?.min;
  const max = ad.scope_of_work?.max;
  const normalized = normalizeText(label);

  if (normalized.includes("heltid") || min === 100 || max === 100) {
    return { extent: "full_time" as const, label: buildEmploymentLabel("Heltid", ad), scopeMin: min, scopeMax: max };
  }

  if (normalized.includes("deltid") || (typeof max === "number" && max > 0 && max < 100)) {
    return { extent: "part_time" as const, label: buildEmploymentLabel("Deltid", ad), scopeMin: min, scopeMax: max };
  }

  if (normalized.includes("heltid/deltid") || normalized.includes("varierande")) {
    return { extent: "mixed" as const, label: buildEmploymentLabel("Heltid/deltid", ad), scopeMin: min, scopeMax: max };
  }

  return { extent: "unclear" as const, label: buildEmploymentLabel("Omfattning ej angiven", ad), scopeMin: min, scopeMax: max };
}

function buildEmploymentLabel(base: string, ad: JobTechAd) {
  const min = ad.scope_of_work?.min;
  const max = ad.scope_of_work?.max;
  if (typeof min === "number" && typeof max === "number") {
    return min === max ? `${base}, ${max}%` : `${base}, ${min}-${max}%`;
  }
  return base;
}
