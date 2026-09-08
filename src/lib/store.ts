import { mkdir, readFile, writeFile, appendFile, stat } from "node:fs/promises";
import path from "node:path";
import { insertApplyClick, insertSponsorEvent } from "./db";
import { getApprovedPaidJobsAsJobs } from "./monetization-store";
import type { Job, JobDatabase, SyncState } from "./types";

const dataDir = path.join(process.cwd(), "data");
const jobsPath = path.join(dataDir, "jobs.json");
const syncStatePath = path.join(dataDir, "sync-state.json");
const clicksPath = path.join(dataDir, "apply-clicks.jsonl");
const reportsPath = path.join(dataDir, "reports.jsonl");
const sponsorEventsPath = path.join(dataDir, "sponsor-events.jsonl");
const clientErrorsPath = path.join(dataDir, "client-errors.jsonl");
const inactiveRetentionDays = Math.max(1, Number(process.env.JOBS_INACTIVE_RETENTION_DAYS ?? 14));
const inactiveHardCap = Math.max(100, Number(process.env.JOBS_INACTIVE_HARD_CAP ?? 5000));
const maxDescriptionChars = Math.max(500, Number(process.env.JOBS_DESCRIPTION_MAX_CHARS ?? 4000));
const maxSummaryChars = Math.max(200, Number(process.env.JOBS_SUMMARY_MAX_CHARS ?? 900));
let jobsCache: { signature: string | null; jobs: Job[] } = { signature: null, jobs: [] };
let liveJobsCache: { signature: string | null; dateKey: string; paidSignature: string; jobs: Job[] } = {
  signature: null,
  dateKey: "",
  paidSignature: "",
  jobs: []
};

export async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

export async function readJobs(): Promise<Job[]> {
  await ensureDataDir();
  const signature = await getFileSignature(jobsPath);
  if (signature && jobsCache.signature === signature) return jobsCache.jobs;

  try {
    const raw = await readFile(jobsPath, "utf8");
    const jobs = (JSON.parse(raw) as JobDatabase).jobs ?? [];
    jobsCache = { signature, jobs };
    return jobs;
  } catch {
    jobsCache = { signature: null, jobs: [] };
    return [];
  }
}

export async function writeJobs(jobs: Job[]) {
  await ensureDataDir();
  const preparedJobs = prepareJobsForStorage(jobs);
  const db: JobDatabase = {
    jobs: preparedJobs,
    updatedAt: new Date().toISOString()
  };
  await writeFile(jobsPath, `${JSON.stringify(db)}\n`, "utf8");
  jobsCache = { signature: await getFileSignature(jobsPath), jobs: db.jobs };
  liveJobsCache = { signature: null, dateKey: "", paidSignature: "", jobs: [] };
}

export async function upsertJobs(incoming: Job[]) {
  const existing = await readJobs();
  const byId = new Map(existing.map((job) => [job.id, job]));

  for (const job of incoming) {
    byId.set(job.id, { ...byId.get(job.id), ...job, updatedAt: new Date().toISOString() });
  }

  await writeJobs(Array.from(byId.values()));
}

export async function markRemoved(sourceAdId: string) {
  const jobs = await readJobs();
  const now = new Date().toISOString();
  await writeJobs(
    jobs.map((job) =>
      job.sourceAdId === sourceAdId ? { ...job, status: "removed", updatedAt: now } : job
    )
  );
}

export async function getLiveJobs() {
  const today = new Date();
  const jobs = await readJobs();
  const paidJobs = await getApprovedPaidJobsAsJobs();
  const paidSignature = paidJobs.map((job) => `${job.id}:${job.updatedAt}`).join("|");
  const dateKey = today.toISOString().slice(0, 10);
  if (liveJobsCache.signature === jobsCache.signature && liveJobsCache.dateKey === dateKey && liveJobsCache.paidSignature === paidSignature) {
    return liveJobsCache.jobs;
  }

  const live = [...jobs, ...paidJobs].filter((job) => {
    if (job.status !== "live") return false;
    if (job.applyLinkStatus === "failed") return false;
    if (!job.applicationDeadline) return true;
    const deadline = new Date(job.applicationDeadline);
    return Number.isNaN(deadline.getTime()) || deadline >= today;
  });

  const deduped = dedupeJobsByApplyUrl(live);
  liveJobsCache = { signature: jobsCache.signature, dateKey, paidSignature, jobs: deduped };
  return deduped;
}

async function getFileSignature(filePath: string) {
  try {
    const file = await stat(filePath);
    return `${file.mtimeMs}:${file.size}`;
  } catch {
    return null;
  }
}

function prepareJobsForStorage(jobs: Job[]) {
  const now = new Date();
  const inactiveCutoff = now.getTime() - inactiveRetentionDays * 24 * 60 * 60 * 1000;
  const active: Job[] = [];
  const inactive: Job[] = [];

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

function compactJob(job: Job): Job {
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

function trimText(value: string | undefined, maxLength: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function compactStringArray(value: string[] | undefined, maxItems: number, maxItemLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => trimText(item, maxItemLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function isActiveJobForStorage(job: Job, now: Date) {
  if (job.status !== "live") return false;
  if (!job.applicationDeadline) return true;
  const deadline = new Date(job.applicationDeadline);
  return Number.isNaN(deadline.getTime()) || deadline >= now;
}

function compareJobsNewestFirst(a: Job, b: Job) {
  return getJobSortTime(b) - getJobSortTime(a);
}

function getJobSortTime(job: Job) {
  return dateMs(job.publicationDate) || dateMs(job.updatedAt) || 0;
}

function getJobUpdatedTime(job: Job) {
  return dateMs(job.updatedAt) || dateMs(job.publicationDate) || 0;
}

function dateMs(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function findJob(id: string) {
  const jobs = await readJobs();
  return jobs.find((job) => job.id === id)
    || (await getApprovedPaidJobsAsJobs()).find((job) => job.id === id);
}

export async function readSyncState(): Promise<SyncState> {
  await ensureDataDir();
  try {
    return JSON.parse(await readFile(syncStatePath, "utf8")) as SyncState;
  } catch {
    return {};
  }
}

export async function writeSyncState(state: SyncState) {
  await ensureDataDir();
  await writeFile(syncStatePath, JSON.stringify(state, null, 2), "utf8");
}

export async function appendApplyClick(event: Record<string, unknown>) {
  if (await insertApplyClick(event)) return;
  await ensureDataDir();
  await appendFile(clicksPath, `${JSON.stringify({ ...event, clickedAt: new Date().toISOString() })}\n`, "utf8");
}

export async function appendReport(event: Record<string, unknown>) {
  await ensureDataDir();
  await appendFile(reportsPath, `${JSON.stringify({ ...event, createdAt: new Date().toISOString() })}\n`, "utf8");
}

export async function appendSponsorEvent(event: Record<string, unknown>) {
  if (await insertSponsorEvent(event)) return;
  await ensureDataDir();
  await appendFile(sponsorEventsPath, `${JSON.stringify({ ...event, createdAt: new Date().toISOString() })}\n`, "utf8");
}

export async function appendClientError(event: Record<string, unknown>) {
  await ensureDataDir();
  await appendFile(clientErrorsPath, `${JSON.stringify({ ...event, createdAt: new Date().toISOString() })}\n`, "utf8");
}

function dedupeJobsByApplyUrl(jobs: Job[]): Job[] {
  const groups = new Map<string, Job[]>();
  const passthrough: Job[] = [];

  for (const job of jobs) {
    const key = normalizeJobForDedupe(job);
    if (!key) {
      passthrough.push(job);
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }

  const deduped = Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];
    const representative = [...group].sort((a, b) => scoreRepresentative(b) - scoreRepresentative(a))[0];
    return {
      ...representative,
      duplicateCount: group.length - 1,
      duplicateJobIds: group.filter((job) => job.id !== representative.id).map((job) => job.id)
    };
  });

  return [...passthrough, ...deduped].sort((a, b) => {
    const aTime = new Date(a.publicationDate ?? a.updatedAt).getTime();
    const bTime = new Date(b.publicationDate ?? b.updatedAt).getTime();
    return bTime - aTime;
  });
}

function normalizeApplyUrlForDedupe(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${path}${url.search}`;
  } catch {
    return "";
  }
}

function normalizeJobForDedupe(job: Job) {
  const applyKey = normalizeApplyUrlForDedupe(job.applyUrl);
  if (applyKey) return `apply:${applyKey}`;
  if (job.canonicalFingerprint) return `fingerprint:${job.canonicalFingerprint}`;

  const title = normalizeLoose(job.title || job.titleCanonical);
  const employer = normalizeLoose(job.employerName);
  const municipality = normalizeLoose(job.municipality);
  if (!title || !employer || !municipality) return "";

  return `soft:${employer}|${title}|${municipality}|${job.applicationDeadline ?? ""}`;
}

function normalizeLoose(value = "") {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreRepresentative(job: Job) {
  let score = 0;
  const text = `${job.titleCanonical ?? ""} ${job.title ?? ""}`.toLowerCase();

  if (job.mustHaveSummary.length) score += 10;
  if (job.niceToHaveSummary.length) score += 4;
  if (job.languageLabels.length && !job.languageLabels.includes("Ej angivet")) score += 3;
  if (job.salaryText && job.salaryText !== "Lön ej angiven") score += 2;
  if (job.employmentExtent !== "unclear") score += 2;
  if (job.employerVerified) score += 6;
  if (job.applyLinkStatus === "ok") score += 4;
  if (job.applyLinkStatus === "failed") score -= 20;
  if (typeof job.trustScore === "number") score += Math.round(job.trustScore / 10);

  if (/söker personal|personal\s*\(|medarbetare|extrapersonal/i.test(text)) score -= 20;
  if (/säljare|account manager/i.test(text)) score -= 10;
  if (/köksbiträde|kökspersonal|serveringspersonal|kock|undersköterska|backend utvecklare|frontend utvecklare|fullstack utvecklare/i.test(text)) score += 8;

  return score;
}
