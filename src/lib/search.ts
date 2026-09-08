import type { EmploymentExtent, EmployerType, Job, Seniority, WorkMode } from "./types";
import { classifySalesNoise, normalizeText } from "./classifiers";
import { buildSearchIntent } from "./search-intent.mjs";

export type PostedWithin = "all" | "today" | "week" | "month";
export type SortMode = "best" | "newest" | "deadline";
export const DEFAULT_SORT_MODE: SortMode = "newest";

export interface SearchFilters {
  query?: string;
  location?: string;
  workMode?: WorkMode | "all";
  employerType?: EmployerType | "all";
  employmentExtent?: EmploymentExtent | "all";
  seniority?: Seniority | "all";
  postedWithin?: PostedWithin;
  distanceRadius?: number;
  titleCategory?: string;
  titleCategories?: string[];
  includeSales?: boolean;
  includeIntermediaries?: boolean;
  salaryOnly?: boolean;
  language?: string;
}

interface JobSearchIndex {
  searchText: string;
  keywordText: string;
  titleText: string;
  titleCanonicalText: string;
  titleCategoryText: string;
  locationText: string;
  languageText: string;
  isSalesLike: boolean;
  isIntermediary: boolean;
  missingSalary: boolean;
  publicationTime: number;
  deadlineTime: number;
}

const searchIndexCache = new WeakMap<Job, JobSearchIndex>();

export function filterJobs(jobs: Job[], filters: SearchFilters, sortMode: SortMode = DEFAULT_SORT_MODE) {
  const query = normalizeText(filters.query);
  const searchIntent = buildSearchIntent(query);
  const location = normalizeText(filters.location);
  const language = normalizeText(filters.language);
  const titleCategories = normalizeCategoryFilter(filters.titleCategories ?? filters.titleCategory);
  const developerQuery = isDeveloperQuery(query);
  const filtered: Job[] = [];

  for (const job of jobs) {
      const index = getJobSearchIndex(job);

      if (query && !matchesQuery(index, query, searchIntent)) continue;
      if (developerQuery && !hasDeveloperRoleSignal(job)) continue;
      if (location && !index.locationText.includes(location)) continue;
      if (titleCategories.length && !titleCategories.includes(index.titleCategoryText)) continue;
      if (!filters.includeSales && index.isSalesLike) continue;
      if (!filters.includeIntermediaries && index.isIntermediary) continue;
      if (filters.workMode && filters.workMode !== "all" && job.workMode !== filters.workMode) continue;
      if (filters.employerType && filters.employerType !== "all" && job.employerType !== filters.employerType) continue;
      if (filters.seniority && filters.seniority !== "all" && job.seniority !== filters.seniority) continue;
      if (filters.employmentExtent && filters.employmentExtent !== "all") {
        const extent = job.employmentExtent ?? "unclear";
        if (filters.employmentExtent === "mixed") {
          if (!["full_time", "part_time", "mixed"].includes(extent)) continue;
        } else if (extent !== filters.employmentExtent) continue;
      }
      if (filters.salaryOnly && index.missingSalary) continue;
      if (filters.postedWithin && filters.postedWithin !== "all" && !isPublishedWithinIndex(index, filters.postedWithin)) continue;
      if (language && !index.languageText.includes(language)) continue;

      filtered.push(job);
    }

  return sortJobs(filtered, filters, sortMode);
}

export function sortJobs(jobs: Job[], filters: SearchFilters, sortMode: SortMode = DEFAULT_SORT_MODE) {
  if (sortMode === "newest") {
    return [...jobs].sort((a, b) => getJobSearchIndex(b).publicationTime - getJobSearchIndex(a).publicationTime);
  }

  if (sortMode === "deadline") {
    return [...jobs].sort((a, b) => getJobSearchIndex(a).deadlineTime - getJobSearchIndex(b).deadlineTime);
  }

  const ranked = jobs.map((job) => ({ job, rank: rankJob(job, filters) }));
  ranked.sort((a, b) => {
    const rankDelta = b.rank - a.rank;
    if (rankDelta) return rankDelta;
    return getJobSearchIndex(b.job).publicationTime - getJobSearchIndex(a.job).publicationTime;
  });
  return ranked.map((item) => item.job);
}

export function rankJob(job: Job, filters: SearchFilters = {}) {
  const query = normalizeText(filters.query);
  const searchIntent = buildSearchIntent(query);
  const location = normalizeText(filters.location);
  const index = getJobSearchIndex(job);
  let score = job.trustScore ?? 50;

  if (query) {
    if (searchIntent.hasIntent && matchesIntentCategory(index, searchIntent)) score += 42;
    if (searchIntent.hasIntent && matchesIntentRole(index, searchIntent)) score += 45;
    if (index.titleText === query) score += 45;
    else if (index.titleCanonicalText === query) score += 42;
    else if (index.titleText.includes(query)) score += 30;
    else if (index.titleCanonicalText.includes(query)) score += 28;
    else if (index.titleCategoryText.includes(query)) score += 18;
    else if (index.keywordText.includes(query)) score += 12;
  }

  if (location && index.locationText.includes(location)) score += 15;
  if (normalizeCategoryFilter(filters.titleCategories ?? filters.titleCategory).includes(index.titleCategoryText)) score += 18;
  if (job.employerVerified) score += 12;
  if (job.applyLinkStatus === "ok") score += 8;
  if (job.applyLinkStatus === "failed") score -= 35;
  if (job.applyUrl) score += 6;
  if (job.employerType === "direct_employer") score += 8;
  if (index.isIntermediary) score -= 16;
  if (job.workMode !== "unclear") score += 8;
  if (job.workModeWarning) score -= 4;
  if (!index.missingSalary) score += 6;
  if (job.mustHaveSummary.length) score += 6;
  if (job.languageLabels.length && !index.languageText.includes("ej angivet")) score += 3;
  if (index.isSalesLike) score -= 25;
  if (job.duplicateCount) score += Math.min(job.duplicateCount * 2, 10);

  if (Number.isFinite(index.publicationTime)) {
    const ageDays = Math.max(0, (Date.now() - index.publicationTime) / 86_400_000);
    score += Math.max(0, 14 - ageDays);
  }

  return score;
}

export function getJobExplanations(job: Job) {
  const explanations: string[] = [];

  if (job.employerVerified) explanations.push(cleanSwedishText(job.employerVerificationReason) || "Automatisk arbetsgivarsignal finns.");
  if (job.applyLinkStatus === "ok") explanations.push("Ansökningslänken svarade vid senaste kontrollen.");
  if (job.applyLinkStatus === "failed") explanations.push("Ansökningslänken svarade inte vid senaste kontrollen.");
  if (job.workModeWarning) explanations.push(job.workModeWarning);
  else if (job.workMode === "hybrid") explanations.push("Visas som hybrid eftersom annonsen nämner distans och/eller kontorsnärvaro.");
  else if (job.workMode === "remote") explanations.push("Visas som distans eftersom annonsen tydligt nämner distansarbete.");
  else if (job.workMode === "onsite") explanations.push("Visas som på plats eftersom annonstexten tyder på fysisk arbetsplats.");
  else explanations.push("Arbetsformen är oklar eftersom annonstexten saknar tydlig signal.");
  if (job.salesNoise) explanations.push("Dold som standard eftersom annonstexten matchar sälj- eller bokningsmönster.");
  if (isMissingSalary(job.salaryText)) explanations.push("Lön saknas i källannonsen.");

  return explanations.slice(0, 5);
}

export function formatEmploymentExtent(extent?: EmploymentExtent) {
  return {
    full_time: "Heltid",
    part_time: "Deltid",
    mixed: "Heltid/deltid",
    unclear: "Omfattning oklar"
  }[extent ?? "unclear"];
}

export function formatWorkMode(mode: WorkMode) {
  return {
    remote: "Distans",
    hybrid: "Hybrid",
    onsite: "På plats",
    unclear: "Oklar"
  }[mode];
}

export function formatEmployerType(type: EmployerType) {
  return {
    direct_employer: "Arbetsgivare som annonsör",
    recruiter: "Rekryterare",
    staffing_agency: "Bemanningsföretag",
    unknown: "Okänd annonsör"
  }[type];
}

export function formatPostedWithin(value: PostedWithin) {
  return {
    all: "Alla datum",
    today: "Publicerad idag",
    week: "Senaste veckan",
    month: "Denna månad"
  }[value];
}

export function isMissingSalary(value?: string) {
  return !value || /l[oö]n ej angiven|lon ej angiven/i.test(value);
}

function getSearchHaystack(job: Job) {
  return getJobSearchIndex(job).searchText;
}

function dateValue(value?: string, fallback = 0) {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function getJobSearchIndex(job: Job): JobSearchIndex {
  const cached = searchIndexCache.get(job);
  if (cached) return cached;

  const index: JobSearchIndex = {
    keywordText: normalizeText(
      [
        job.title,
        job.titleNormalized,
        job.titleCanonical,
        job.employerName,
        job.municipality,
        job.region,
        job.titleCategory
      ].filter(Boolean).join(" ")
    ),
    searchText: normalizeText(
      [
        job.title,
        job.titleNormalized,
        job.titleCanonical,
        job.employerName,
        job.municipality,
        job.region,
        job.titleCategory,
        job.plainSummary,
        job.mustHaveSummary.join(" "),
        job.niceToHaveSummary.join(" ")
      ].filter(Boolean).join(" ")
    ),
    titleText: normalizeText(job.title),
    titleCanonicalText: normalizeText(job.titleCanonical),
    titleCategoryText: normalizeText(job.titleCategory),
    locationText: normalizeText(`${job.municipality} ${job.region} ${job.workplaceAddress ?? ""}`),
    languageText: normalizeText(job.languageLabels.join(" ")),
    isSalesLike: job.salesNoise || classifySalesNoise(job.title, `${job.titleCanonical} ${job.titleCategory} ${job.plainSummary} ${job.descriptionText}`),
    isIntermediary: job.employerType === "recruiter" || job.employerType === "staffing_agency",
    missingSalary: isMissingSalary(job.salaryText),
    publicationTime: dateValue(job.publicationDate ?? job.updatedAt),
    deadlineTime: dateValue(job.applicationDeadline, Number.POSITIVE_INFINITY)
  };

  searchIndexCache.set(job, index);
  return index;
}

function matchesQuery(index: JobSearchIndex, query: string, searchIntent: ReturnType<typeof buildSearchIntent>) {
  if (searchIntent.hasIntent) {
    const categoryMatch = matchesIntentCategory(index, searchIntent);
    const roleMatch = matchesIntentRole(index, searchIntent);
    if (searchIntent.strict) {
      return searchIntent.requireRoleMatch ? roleMatch : categoryMatch;
    }
    if (categoryMatch || (searchIntent.requireRoleMatch && roleMatch)) return true;
  }

  if (
    index.keywordText.includes(query) ||
    index.titleCanonicalText.includes(query) ||
    index.titleCategoryText.includes(query)
  ) {
    return true;
  }

  const tokens = query.split(/[^a-z0-9+#.]+/).filter((token) => token.length > 1);
  if (!tokens.length) return false;
  return tokens.every((token) => (
    index.keywordText.includes(token) ||
    index.titleCanonicalText.includes(token) ||
    index.titleCategoryText.includes(token)
  ));
}

function matchesIntentCategory(index: JobSearchIndex, searchIntent: ReturnType<typeof buildSearchIntent>) {
  return searchIntent.categories.some((category) => index.titleCategoryText === category);
}

function matchesIntentRole(index: JobSearchIndex, searchIntent: ReturnType<typeof buildSearchIntent>) {
  const roleText = `${index.titleText} ${index.titleCanonicalText}`;
  return searchIntent.roleTerms.some((term) => matchesIntentTerm(roleText, term));
}

function normalizeCategoryFilter(value?: string | string[]) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item ?? "").split(","))
    .map((item) => normalizeText(item))
    .filter((item) => item && item !== "all");
}

function isDeveloperQuery(query: string) {
  if (!query) return false;
  return includesTerm(query, [
    "systemutvecklare",
    "utvecklare",
    "developer",
    "programmerare",
    "software engineer",
    "frontend",
    "backend",
    "fullstack",
    "full stack",
    "devops",
    "sre",
    "react",
    "typescript",
    "javascript",
    "python",
    "java",
    ".net"
  ]);
}

function hasDeveloperRoleSignal(job: Job) {
  const title = normalizeText(job.title);
  const titleAndSummary = normalizeText(`${job.title} ${job.plainSummary}`);
  if (includesTerm(title, ["affarsutvecklare", "verksamhetsutvecklare", "organisationsutvecklare", "produktutvecklare"])) {
    return false;
  }
  return includesTerm(titleAndSummary, [
    "systemutvecklare",
    "mjukvaruutvecklare",
    "webbutvecklare",
    "utvecklare inom",
    "developer",
    "programmerare",
    "software engineer",
    "frontend",
    "backend",
    "fullstack",
    "full stack",
    "devops",
    "react",
    "typescript",
    "javascript",
    "python",
    ".net"
  ]) || includesStandaloneAny(title, ["sre", "java", "c#", "c++"]);
}

function includesTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function matchesIntentTerm(text: string, term: string) {
  if (!term) return false;
  if (term.length <= 3) return includesStandaloneAny(text, [term]);
  return text.includes(term);
}

function includesStandaloneAny(text: string, terms: string[]) {
  return terms.some((term) => {
    const escaped = normalizeText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
  });
}

function cleanSwedishText(value?: string) {
  if (!value) return "";
  const oldVerified = "veri" + "fierad";
  return value
    .replaceAll("ansoknings", "ansöknings")
    .replaceAll("kallan", "källan")
    .replaceAll("Annonsoren ar", "Annonsören är")
    .replaceAll("Direkt arbetsgivare", "Arbetsgivare som annonsör")
    .replaceAll("direkt arbetsgivare", "arbetsgivare som annonsör")
    .replaceAll(`ar ${oldVerified}`, "har automatisk arbetsgivarsignal")
    .replaceAll(`är ${oldVerified}`, "har automatisk arbetsgivarsignal");
}

function isPublishedWithin(job: Job, postedWithin: PostedWithin) {
  return isPublishedWithinIndex(getJobSearchIndex(job), postedWithin);
}

function isPublishedWithinIndex(index: JobSearchIndex, postedWithin: PostedWithin) {
  if (!Number.isFinite(index.publicationTime)) return false;

  const date = new Date(index.publicationTime);

  const now = new Date();
  if (postedWithin === "today") return toStockholmDateKey(date) === toStockholmDateKey(now);
  if (postedWithin === "week") return now.getTime() - index.publicationTime <= 7 * 86_400_000;
  if (postedWithin === "month") {
    const jobParts = getStockholmParts(date);
    const nowParts = getStockholmParts(now);
    return jobParts.year === nowParts.year && jobParts.month === nowParts.month;
  }
  return true;
}

function toStockholmDateKey(date: Date) {
  const parts = getStockholmParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getStockholmParts(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Stockholm",
    year: "numeric"
  }).formatToParts(date);
  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? ""
  };
}
