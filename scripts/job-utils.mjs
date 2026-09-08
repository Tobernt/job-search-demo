import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const dataDir = path.join(process.cwd(), "data");
export const jobsPath = path.join(dataDir, "jobs.json");
export const syncStatePath = path.join(dataDir, "sync-state.json");
const inactiveRetentionDays = Math.max(1, Number(process.env.JOBS_INACTIVE_RETENTION_DAYS ?? 14));
const inactiveHardCap = Math.max(100, Number(process.env.JOBS_INACTIVE_HARD_CAP ?? 5000));
const maxDescriptionChars = Math.max(500, Number(process.env.JOBS_DESCRIPTION_MAX_CHARS ?? 4000));
const maxSummaryChars = Math.max(200, Number(process.env.JOBS_SUMMARY_MAX_CHARS ?? 900));

export async function readJobs() {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(jobsPath, "utf8");
    return JSON.parse(raw).jobs ?? [];
  } catch {
    return [];
  }
}

export async function writeJobs(jobs) {
  await mkdir(dataDir, { recursive: true });
  const prepared = prepareJobsForStorage(jobs);
  await writeFile(jobsPath, `${JSON.stringify({ jobs: prepared, updatedAt: new Date().toISOString() })}\n`, "utf8");
}

export async function readSyncState() {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(syncStatePath, "utf8"));
  } catch {
    return {};
  }
}

export async function writeSyncState(state) {
  await mkdir(dataDir, { recursive: true });
  const current = await readCurrentSyncState();
  const merged = preserveNewestSyncTimestamps(current, { ...current, ...state });
  const tmpPath = `${syncStatePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(merged, null, 2), "utf8");
  await rename(tmpPath, syncStatePath);
}

async function readCurrentSyncState() {
  try {
    return JSON.parse(await readFile(syncStatePath, "utf8"));
  } catch {
    return {};
  }
}

function preserveNewestSyncTimestamps(current, next) {
  const merged = { ...next };
  for (const field of [
    "jobstreamLastSuccessAt",
    "jobstreamLastAttemptAt",
    "jobstreamLastFinishedAt",
    "jobstreamLastFailedAt",
    "lastWorkerHeartbeatAt",
    "reportQualityLastRunAt",
    "lastMaintenanceRunAt",
    "lastMaintenanceFailedAt",
    "sourceImportLastSuccessAt",
    "sourceImportLastAttemptAt",
    "sourceImportLastFinishedAt",
    "sourceImportLastFailedAt",
    "sourceRefreshLastSuccessAt",
    "sourceRefreshLastAttemptAt",
    "sourceRefreshLastFinishedAt",
    "sourceRefreshLastFailedAt"
  ]) {
    if (isNewerTimestamp(current[field], merged[field])) {
      merged[field] = current[field];
    }
  }
  return merged;
}

function isNewerTimestamp(candidate, existing) {
  if (!candidate || !existing) return Boolean(candidate && !existing);
  const candidateTime = new Date(candidate).getTime();
  const existingTime = new Date(existing).getTime();
  return Number.isFinite(candidateTime) && Number.isFinite(existingTime) && candidateTime > existingTime;
}

function prepareJobsForStorage(jobs) {
  const now = new Date();
  const inactiveCutoff = now.getTime() - inactiveRetentionDays * 24 * 60 * 60 * 1000;
  const active = [];
  const inactive = [];

  for (const rawJob of jobs) {
    const job = compactJob(rawJob);
    if (isActiveJobForStorage(job, now)) {
      active.push(job);
    } else if (getJobUpdatedTime(job) >= inactiveCutoff) {
      inactive.push(job);
    }
  }

  inactive.sort(compareJobsNewestFirst);
  return [...active, ...inactive.slice(0, inactiveHardCap)].sort(compareJobsNewestFirst);
}

function compactJob(job) {
  return {
    ...job,
    descriptionText: trimText(job.descriptionText, maxDescriptionChars),
    plainSummary: trimText(job.plainSummary, maxSummaryChars),
    mustHaveSummary: compactStringArray(job.mustHaveSummary, 8, 180),
    niceToHaveSummary: compactStringArray(job.niceToHaveSummary, 8, 180),
    languageLabels: compactStringArray(job.languageLabels, 8, 80),
    duplicateJobIds: Array.isArray(job.duplicateJobIds) ? job.duplicateJobIds.slice(0, 25) : undefined
  };
}

function trimText(value, maxLength) {
  if (typeof value !== "string") return value;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function compactStringArray(value, maxItems, maxItemLength) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => trimText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isActiveJobForStorage(job, now) {
  if (job.status !== "live") return false;
  if (!job.applicationDeadline) return true;
  const deadline = new Date(job.applicationDeadline);
  return Number.isNaN(deadline.getTime()) || deadline >= now;
}

function compareJobsNewestFirst(a, b) {
  return getJobSortTime(b) - getJobSortTime(a);
}

function getJobSortTime(job) {
  return dateMs(job.publicationDate) || dateMs(job.updatedAt) || 0;
}

function getJobUpdatedTime(job) {
  return dateMs(job.updatedAt) || dateMs(job.publicationDate) || 0;
}

function dateMs(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesAny(text, needles) {
  const normalized = normalizeText(text);
  return needles.some((needle) => normalized.includes(normalizeText(needle)));
}

export function normalizeAd(ad) {
  const sourceAdId = String(ad.id);
  const descriptionText = ad.description?.text ?? "";
  const title = ad.headline?.trim() || "Titel saknas";
  const employerName = ad.employer?.name?.trim() || "Arbetsgivare saknas";
  const employerType = classifyEmployerType(ad);
  const applyUrl = ad.application_details?.url || ad.webpage_url || "";
  const workMode = classifyWorkMode(descriptionText);
  const employment = classifyEmploymentExtent(ad);
  const canonicalTitle = canonicalizeTitle(ad);
  const publicationDate = ad.publication_date ?? ad.timestamp ?? new Date().toISOString();
  const now = new Date().toISOString();
  const salaryText = extractSalary(ad);
  const mustHaveSummary = extractRequirementLines(ad, "must");
  const niceToHaveSummary = extractRequirementLines(ad, "nice");
  const salesNoise = classifySalesNoise(title, descriptionText);
  const applyDomain = getDomain(applyUrl);
  const applyType = classifyApplyType(applyUrl, employerType);
  const employerVerified = verifyEmployerSignal(employerName, applyDomain, employerType, applyType, ad.employer?.organization_number);

  return {
    id: stableId("jobtech", sourceAdId),
    source: "jobtech",
    sourceAdId,
    sourceUrl: ad.webpage_url ?? "",
    logoUrl: ad.logo_url,
    title,
    titleNormalized: title.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim(),
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
    status: ad.removed || ad.removed_date ? "removed" : "live",
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
    trustScore: calculateTrustScore({
      employerType,
      employerVerified: employerVerified.verified,
      applyUrl,
      applyType,
      workModeConfidence: workMode.confidence,
      salaryText,
      mustHaveCount: mustHaveSummary.length,
      niceToHaveCount: niceToHaveSummary.length,
      salesNoise
    }),
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
    classificationVersion: "rules-v2"
  };
}

export function isSwedishJob(ad) {
  const country = normalizeText(ad.workplace_address?.country);
  const countryCode = String(ad.workplace_address?.country_code ?? "").toLowerCase();
  if (["sverige", "sweden", "se"].includes(country)) return true;
  if (["199", "se"].includes(countryCode)) return true;
  if (ad.workplace_address?.municipality || ad.workplace_address?.region) return true;
  return /sverige|sweden|stockholm|göteborg|goteborg|malmö|malmo/i.test(`${ad.employer?.name ?? ""} ${ad.description?.text ?? ""}`);
}

export function classifyWorkMode(text) {
  if (includesAny(text, ["hybrid", "hybridarbete", "mojlighet till distansarbete", "dagar pa kontoret", "minimum two days a week"])) {
    return { mode: "hybrid", confidence: 0.9 };
  }
  if (includesAny(text, ["100% distans", "helt pa distans", "jobba hemifran", "fully remote", "work from anywhere"])) {
    return { mode: "remote", confidence: 0.85 };
  }
  if (includesAny(text, ["pa plats", "skiftarbete", "butik", "lager", "vardavdelning", "restaurang"])) {
    return { mode: "onsite", confidence: 0.72 };
  }
  if (includesAny(text, ["distans"])) {
    return { mode: "unclear", confidence: 0.45, warning: "Annonsen nämner distans, men arbetsformen är inte tydlig nog." };
  }
  return { mode: "unclear", confidence: 0.3 };
}

function classifySalesNoise(title, text) {
  const titleValue = normalizeText(title);
  const value = `${title} ${text}`;
  if (includesAny(value, ["business analyst", "produktagare"])) return false;
  if (includesAny(titleValue, [
    "salj",
    "forsalj",
    "sales",
    "account manager",
    "account executive",
    "key account",
    "sales promoter",
    "business development representative",
    "customer service & sales",
    "kundbokare",
    "bokare"
  ])) return true;
  return includesAny(value, [
    "saljare",
    "forsaljning",
    "forsaljningsassistent",
    "account manager",
    "account executive",
    "key account",
    "sales promoter",
    "sales manager",
    "area sales",
    "inside sales",
    "business oriented sales",
    "business development representative",
    "telefonforsaljning",
    "faltforsaljare",
    "door to door",
    "provisionslon",
    "kundbokare",
    "bokare"
  ]);
}

function classifyEmployerType(ad) {
  const value = `${ad.employer?.name ?? ""} ${ad.headline ?? ""} ${ad.description?.text ?? ""}`;
  if (includesAny(value, ["bemanning", "staffing", "konsultuthyrning"])) return "staffing_agency";
  if (includesAny(value, ["rekrytering", "recruitment", "consulting"])) return "recruiter";
  return ad.employer?.name ? "direct_employer" : "unknown";
}

function classifyApplyType(url, employerType) {
  if (!url) return "unknown";
  if (url.startsWith("mailto:")) return "email";
  if (url.includes("arbetsformedlingen.se")) return "via_af";
  if (employerType === "recruiter" || employerType === "staffing_agency") return "recruiter";
  const host = getDomain(url);
  if (["teamtailor.com", "varbi.com", "workbuster.com", "jobylon.com", "reachmee.com"].some((domain) => host.includes(domain))) return "ats";
  return "employer_site";
}

export function classifySeniority(title, text) {
  const value = `${title} ${text}`;
  const titleOnly = normalizeText(title);
  if (includesAny(titleOnly, ["lead", "tech lead", "principal", "arkitekt", "chef", "manager"])) return "lead";
  if (includesStandaloneAny(titleOnly, ["senior"]) || includesAny(value, ["erfaren", "specialist", "minst 5 ar", "minst fem ar", "5+ ar"])) return "senior";
  if (includesAny(value, ["junior", "trainee", "nyutexaminerad"])) return "junior";
  if (includesAny(value, ["medior", "nagot ars erfarenhet", "några års erfarenhet"])) return "medior";
  return "unclear";
}

function extractLanguages(ad, text) {
  const labels = new Set();
  for (const language of [...(ad.must_have?.languages ?? []), ...(ad.nice_to_have?.languages ?? [])]) {
    if (language.label) labels.add(language.label);
  }
  if (includesAny(text, ["svenska i tal och skrift", "goda kunskaper i svenska", "flytande svenska"])) labels.add("Svenska krävs");
  if (includesAny(text, ["english only", "english speaking", "engelska racker", "engelska räcker"])) labels.add("Engelska räcker");
  if (!labels.size && includesAny(text, ["engelska", "english"])) labels.add("Engelska");
  if (!labels.size) labels.add("Ej angivet");
  return Array.from(labels).slice(0, 4);
}

function extractRequirementLines(ad, kind) {
  const block = kind === "must" ? ad.must_have : ad.nice_to_have;
  const structured = [
    ...(block?.skills ?? []),
    ...(block?.languages ?? []),
    ...(block?.work_experiences ?? []),
    ...(block?.education ?? []),
    ...(block?.drivers_license ?? [])
  ].map((item) => item.label).filter(Boolean);
  return Array.from(new Set(structured)).slice(0, 6);
}

function extractSalary(ad) {
  if (ad.salary_description?.trim()) return ad.salary_description.trim();
  const text = ad.description?.text ?? "";
  return text.match(/(\d{2}\s?\d{3}\s?-\s?\d{2}\s?\d{3}\s?kr|\d{2}\s?\d{3}\s?kr|fast lön|timlön|månadslön)/i)?.[0] ?? "Lön ej angiven";
}

function makePlainSummary(ad) {
  const text = (ad.description?.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sammanfattning saknas i källdatan.";
  return text.length > 240 ? `${text.slice(0, 237).trim()}...` : text;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function buildWorkplaceAddress(ad) {
  const address = ad.workplace_address;
  if (!address) return undefined;

  const parts = [
    address.street_address,
    address.postcode,
    address.city,
    address.municipality,
    address.region,
    address.country ?? "Sverige"
  ].filter((part) => typeof part === "string" && part.trim());

  return Array.from(new Set(parts)).join(", ") || undefined;
}

function verifyEmployerSignal(employerName, applyDomain, employerType, applyType, organizationNumber) {
  if (!employerName || employerType !== "direct_employer") {
    return { verified: false, reason: "Annonsoren ar inte klassad som direkt arbetsgivare." };
  }
  if (organizationNumber) return { verified: true, reason: "Direkt arbetsgivare med organisationsnummer i kallan." };
  if (applyType === "via_af") return { verified: true, reason: "Publicerad via Platsbanken med direkt arbetsgivare i kallan." };
  if (applyType === "employer_site" && applyDomain && domainLooksLikeEmployer(employerName, applyDomain)) {
    return { verified: true, reason: "Ansokningsdomanen matchar arbetsgivarsignalen." };
  }
  if (applyType === "ats" && applyDomain) {
    return { verified: true, reason: "Direkt arbetsgivare med kant rekryteringssystem som ansokningsdestination." };
  }
  return { verified: false, reason: "Ansokningsdestinationen kunde inte verifieras automatiskt." };
}

function domainLooksLikeEmployer(employerName, applyDomain) {
  const domain = normalizeText(applyDomain.replace(/\.(se|com|nu|io|org|net)$/i, ""));
  const employerTokens = normalizeText(employerName)
    .split(" ")
    .filter((token) => token.length >= 4 && !["ab", "jobb", "sverige", "sweden"].includes(token));
  return employerTokens.some((token) => domain.includes(token));
}

function calculateTrustScore(input) {
  let score = 50;
  if (input.employerVerified) score += 18;
  if (input.applyUrl) score += 10;
  if (["employer_site", "ats", "via_af"].includes(input.applyType)) score += 8;
  if (input.employerType === "direct_employer") score += 8;
  if (["recruiter", "staffing_agency"].includes(input.employerType)) score -= 14;
  if (input.workModeConfidence >= 0.8) score += 8;
  if (input.salaryText && !/l[oö]n ej angiven|lon ej angiven/i.test(input.salaryText)) score += 7;
  if (input.mustHaveCount) score += 6;
  if (input.niceToHaveCount) score += 3;
  if (input.salesNoise) score -= 16;
  return Math.max(0, Math.min(100, score));
}

function createCanonicalFingerprint(input) {
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

function normalizeApplyUrlForFingerprint(value) {
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

function stableId(source, sourceAdId) {
  return crypto.createHash("sha1").update(`${source}:${sourceAdId}`).digest("hex").slice(0, 24);
}

function classifyEmploymentExtent(ad) {
  const label = ad.working_hours_type?.label ?? ad.employment_type?.label ?? "";
  const min = ad.scope_of_work?.min;
  const max = ad.scope_of_work?.max;
  const normalized = normalizeText(label);

  if (normalized.includes("heltid") || min === 100 || max === 100) {
    return { extent: "full_time", label: buildEmploymentLabel("Heltid", ad), scopeMin: min, scopeMax: max };
  }

  if (normalized.includes("deltid") || (typeof max === "number" && max > 0 && max < 100)) {
    return { extent: "part_time", label: buildEmploymentLabel("Deltid", ad), scopeMin: min, scopeMax: max };
  }

  if (normalized.includes("heltid/deltid") || normalized.includes("varierande")) {
    return { extent: "mixed", label: buildEmploymentLabel("Heltid/deltid", ad), scopeMin: min, scopeMax: max };
  }

  return { extent: "unclear", label: buildEmploymentLabel("Omfattning ej angiven", ad), scopeMin: min, scopeMax: max };
}

function buildEmploymentLabel(base, ad) {
  const min = ad.scope_of_work?.min;
  const max = ad.scope_of_work?.max;
  if (typeof min === "number" && typeof max === "number") {
    return min === max ? `${base}, ${max}%` : `${base}, ${min}-${max}%`;
  }
  return base;
}

export function canonicalizeTitle(ad) {
  const title = ad.headline ?? "";
  const occupation = `${ad.occupation?.label ?? ""} ${ad.occupation_field?.label ?? ""}`;
  const text = `${title} ${occupation} ${ad.description?.text ?? ""}`;
  const roleText = `${title} ${occupation}`;
  const titleOnlyRules = [
    ["Personlig assistent", "Omsorg", ["personlig assistent", "personliga assistenter", "personlig assistans"]],
    ["Customer Success Manager", "Service", ["customer success manager"]],
    ["Säljare", "Försäljning", ["säljare", "innesäljare", "teknisk säljare", "försäljningsassistent", "sales promoter", "account manager", "account executive", "key account", "area sales", "inside sales"]],
    ["Försäljningschef", "Försäljning", ["försäljningschef", "försäljningchef", "sales manager", "säljchef"]],
    ["Förvaltningschef", "Ledning", ["förvaltningschef"]],
    ["Gruppchef", "Ledning", ["gruppchef"]],
    ["Arbetsledare", "Ledning", ["arbetsledare", "team leader"]],
    ["Operations Manager", "Ledning", ["operations manager"]],
    ["Samordnare", "Administration", ["samordnare", "koordinator", "coordinator"]]
  ];

  for (const [canonicalTitle, titleCategory, terms] of titleOnlyRules) {
    if (includesAny(title, terms)) return { canonicalTitle, titleCategory };
  }

  const priorityRules = [
    ["UX/UI Designer", "IT", ["ux designer", "ux-designer", "ui designer", "ui-designer", "ui/ux", "ux/ui", "user experience", "user interface", "produktdesigner", "product designer", "interaktionsdesigner", "digital designer"]],
    ["Applikationsspecialist", "IT", ["application specialist", "applikationsspecialist", "systemspecialist", "stibo step", "stibo daas"]],
    ["Systemadministratör", "IT", ["systemadministratör", "system administrator", "it-administratör", "it administrator"]],
    ["IT-support", "IT", ["it-support", "supporttekniker", "helpdesk", "servicedesk"]],
    ["BI-utvecklare", "IT", ["business intelligence", "bi-utvecklare", "data warehouse", "power bi"]],
    ["Data Engineer", "IT", ["data engineer", "dataingenjör", "etl developer"]]
  ];

  for (const [canonicalTitle, titleCategory, terms] of priorityRules) {
    if (includesAny(text, terms)) return { canonicalTitle, titleCategory };
  }

  const developer = classifyDeveloperTitle(roleText, text);
  if (developer) return developer;

  const rules = [
    ["Produktägare", "IT", ["produktägare", "product owner"]],
    ["Projektledare", "Projektledning", ["projektledare", "project manager", "program manager"]],
    ["Redovisningsassistent", "Ekonomi", ["redovisningsassistent"]],
    ["Revisor", "Ekonomi", ["revisor", "revision"]],
    ["Ekonom", "Ekonomi", ["ekonom", "controller", "redovisningsekonom"]],
    ["HR-specialist", "HR", ["hr ", "human resources", "rekryterare", "talent acquisition"]],
    ["Jurist", "Juridik", ["jurist", "affärsjurist"]],
    ["Marknadsförare", "Marknad", ["marknadsföring", "kommunikation", "sociala medier", "content"]],
    ["Säljare", "Försäljning", ["säljare", "sales", "account manager", "distriktssäljare", "försäljningschef"]],
    ["Kundtjänstmedarbetare", "Service", ["kundtjänst", "customer service", "supportmedarbetare"]],
    ["Undersköterska", "Vård", ["undersköterska"]],
    ["Sjuksköterska", "Vård", ["sjuksköterska"]],
    ["Läkare", "Vård", ["läkare", "vårdcentral"]],
    ["Veterinär", "Djurvård", ["veterinär"]],
    ["Djursjukskötare", "Djurvård", ["djursjukskötare"]],
    ["Personlig assistent", "Omsorg", ["personlig assistent"]],
    ["Barnskötare", "Utbildning", ["barnskötare"]],
    ["Lärare", "Utbildning", ["lärare", "grundskollärare", "förskollärare"]],
    ["Barnvakt", "Omsorg", ["barnvakt"]],
    ["Kock", "Restaurang", ["kock", "köksmästare", "pastry chef", "chef de partie"]],
    ["Pizzabagare", "Restaurang", ["pizzabagare"]],
    ["Köksbiträde", "Restaurang", ["köksbiträde", "diskare", "kökspersonal"]],
    ["Serveringspersonal", "Restaurang", ["serveringspersonal", "servitör", "servitris", "servitrice", "hovmästare", "restaurangbiträde"]],
    ["Bartender", "Restaurang", ["bartender"]],
    ["Lokalvårdare", "Service", ["lokalvårdare", "städare"]],
    ["Montör", "Industri", ["montör", "köksmontör", "verkstad"]],
    ["Snickare", "Bygg", ["snickare"]],
    ["Målare", "Bygg", ["målare"]],
    ["VVS-montör", "Bygg", ["vvs-montör", "rörmokare"]],
    ["Anläggare", "Bygg", ["anläggare", "va-anläggare", "markentreprenad"]],
    ["Elektriker", "Bygg", ["elektriker"]],
    ["Taxiförare", "Transport", ["taxiförare", "taxichaufför"]],
    ["Chaufför", "Transport", ["chaufför", "förare"]],
    ["Lagerarbetare", "Lager", ["lager", "packare", "operatör"]],
    ["Apotekare/Receptarie", "Apotek", ["apotekare", "receptarie"]],
    ["Butiksmedarbetare", "Handel", ["butik", "butiksmedarbetare"]],
    ["Medarbetare", "Övrigt", ["medarbetare", "extrapersonal", "sommarjobb"]]
  ];

  for (const [canonicalTitle, titleCategory, terms] of rules) {
    if (includesAny(text, terms)) return { canonicalTitle, titleCategory };
  }

  return { canonicalTitle: cleanFallbackTitle(title), titleCategory: "Övrigt" };
}

function classifyDeveloperTitle(roleText, text) {
  const roleValue = normalizeText(roleText);
  if (includesAny(roleValue, ["affarsutvecklare", "verksamhetsutvecklare", "organisationsutvecklare", "produktutvecklare"])) {
    return null;
  }
  if (!(includesAny(roleValue, [
    "utvecklare", "developer", "software engineer", "programmerare", "systemutvecklare",
    ".net", "java", "javascript", "typescript", "react", "vue", "angular", "node",
    "backend", "frontend", "fullstack", "devops", "sre", "kubernetes", "cloud engineer"
  ]) || includesStandaloneAny(roleValue, ["sre", ".net", "c#", "c++"]))) return null;

  if (includesAny(text, ["fullstack", "full stack"])) return { canonicalTitle: "Fullstack Utvecklare", titleCategory: "IT" };
  if (includesAny(roleValue, ["devops", "site reliability", "cloud engineer"]) || includesStandaloneAny(roleValue, ["sre"])) return { canonicalTitle: "DevOps Engineer", titleCategory: "IT" };
  if (includesAny(text, ["frontend", "front-end", "react", "vue", "angular", "javascript", "typescript", "css", "webbutvecklare"])) return { canonicalTitle: "Frontend Utvecklare", titleCategory: "IT" };
  if (includesAny(text, ["backend", "back-end", ".net", " c#", "java", "python", "node", "api", "aws", "azure", "databas", "sql"])) return { canonicalTitle: "Backend Utvecklare", titleCategory: "IT" };
  return { canonicalTitle: "Systemutvecklare", titleCategory: "IT" };
}

function includesStandaloneAny(text, needles) {
  const normalized = normalizeText(text);
  return needles.some((needle) => {
    const escaped = normalizeText(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalized);
  });
}

function cleanFallbackTitle(title) {
  return title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\b(sökes|till|i|för)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || "Övrig tjänst";
}
