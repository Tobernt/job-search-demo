import { readFile } from "node:fs/promises";
import path from "node:path";
import { queryDatabase } from "./db";
import { getLiveJobs } from "./store";

interface ApplyClickRow {
  jobId?: string;
  count?: number | string;
}

interface ApplyClickEvent {
  jobId?: string;
  clickedAt?: string;
}

const clicksPath = path.join(process.cwd(), "data", "apply-clicks.jsonl");

export async function buildEmployerQualityFindings(input: { employerName: string; employerDomain?: string }) {
  const employerName = input.employerName.trim();
  const employerDomain = input.employerDomain?.trim().replace(/^www\./, "").toLowerCase() ?? "";
  const allJobs = await getLiveJobs();
  const jobs = allJobs.filter((job) => {
    const sameName = employerName && job.employerName.toLowerCase().includes(employerName.toLowerCase());
    const sameDomain = employerDomain && job.applyDomain.replace(/^www\./, "").toLowerCase() === employerDomain;
    return sameName || sameDomain;
  });
  const jobIds = jobs.map((job) => job.id);
  const applyClicksLast30Days = await countApplyClicks(jobIds, 30);

  const missingSalary = jobs.filter((job) => !job.salaryText || job.salaryText === "Lön ej angiven").length;
  const missingDeadline = jobs.filter((job) => !job.applicationDeadline).length;
  const unclearWorkMode = jobs.filter((job) => job.workMode === "unclear").length;
  const brokenApplyLinks = jobs.filter((job) => job.applyLinkStatus === "failed").length;
  const duplicateGroups = jobs.reduce((sum, job) => sum + Number(job.duplicateCount ?? 0), 0);
  const directEmployerJobs = jobs.filter((job) => job.employerType === "direct_employer").length;

  return {
    employerName,
    employerDomain,
    generatedAt: new Date().toISOString(),
    activeJobs: jobs.length,
    applyClicksLast30Days,
    missingSalary,
    missingDeadline,
    unclearWorkMode,
    brokenApplyLinks,
    duplicateSignals: duplicateGroups,
    directEmployerShare: jobs.length ? Math.round((directEmployerJobs / jobs.length) * 100) : 0,
    reviewedJobIds: jobIds.slice(0, 100),
    notes: [
      "Rapporten bygger på publika jobbannonser och aggregerade klicksignaler.",
      "Inga kandidatuppgifter, CV:n, e-postadresser eller ansökningar ingår."
    ]
  };
}

async function countApplyClicks(jobIds: string[], days: number) {
  if (!jobIds.length) return 0;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dbRows = await queryDatabase<ApplyClickRow>(`
    select job_id as "jobId", count(*)::int as count
    from apply_clicks
    where clicked_at >= $1 and job_id = any($2::text[])
    group by job_id
  `, [since.toISOString(), jobIds]);

  if (dbRows) {
    return dbRows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
  }

  try {
    const raw = await readFile(clicksPath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as ApplyClickEvent;
        } catch {
          return {};
        }
      })
      .filter((event) => event.jobId && jobIds.includes(event.jobId))
      .filter((event) => new Date(event.clickedAt ?? 0) >= since)
      .length;
  } catch {
    return 0;
  }
}
