import { readFile } from "node:fs/promises";
import path from "node:path";
import { monetizationDashboardData } from "./monetization-store";
import { queryDatabase } from "./db";
import { readJobs, readSyncState } from "./store";

const dataDir = path.join(process.cwd(), "data");
const reportsPath = path.join(dataDir, "reports.jsonl");
const sponsorEventsPath = path.join(dataDir, "sponsor-events.jsonl");
const clientErrorsPath = path.join(dataDir, "client-errors.jsonl");
const workerHeartbeatMaxAgeSeconds = 30 * 60;
const jobSyncMaxAgeSeconds = 6 * 60 * 60;

export async function buildOpsDigest() {
  const now = new Date();
  const [
    jobs,
    syncState,
    monetization,
    reportSummary,
    sponsorSummary,
    clientErrorSummary
  ] = await Promise.all([
    readJobs(),
    readSyncState(),
    monetizationDashboardData(),
    readReportSummary(),
    readSponsorEventSummary(),
    readClientErrorSummary()
  ]);

  const heartbeatAt = syncState.lastWorkerHeartbeatAt ? new Date(syncState.lastWorkerHeartbeatAt).getTime() : 0;
  const successAt = syncState.jobstreamLastSuccessAt ? new Date(syncState.jobstreamLastSuccessAt).getTime() : 0;
  const workerHeartbeatAgeSeconds = heartbeatAt ? Math.round((now.getTime() - heartbeatAt) / 1000) : null;
  const jobSyncAgeSeconds = successAt ? Math.round((now.getTime() - successAt) / 1000) : null;
  const syncError = syncState.lastSyncError ?? syncState.lastWorkerError ?? "";
  const workerHealthy = Boolean(
    heartbeatAt &&
    workerHeartbeatAgeSeconds !== null &&
    workerHeartbeatAgeSeconds <= workerHeartbeatMaxAgeSeconds &&
    !syncState.lastWorkerError
  );
  const freshnessHealthy = Boolean(
    successAt &&
    jobSyncAgeSeconds !== null &&
    jobSyncAgeSeconds <= jobSyncMaxAgeSeconds &&
    !syncError
  );

  const pendingPaidOrders = monetization.paidOrders.filter((order) => order.status === "paid_pending_review");
  const pendingSponsors = monetization.sponsorCampaigns.filter((record) => record.status === "pending");
  const pendingAffiliates = monetization.affiliateCampaigns.filter((record) => record.status === "pending");
  const adSenseId = process.env.NEXT_PUBLIC_ADSENSE_ID?.trim() ?? "";
  const affiliateConfig = affiliateLinkConfig();
  const affiliateClicksLast7Days = monetization.monetizationEvents.filter((event) =>
    event.eventType === "affiliate_click" && ageDays(event.createdAt, now) <= 7
  ).length;
  const critical: string[] = [];
  const warnings: string[] = [];

  if (!workerHealthy) critical.push("Worker heartbeat is stale or missing.");
  if (!freshnessHealthy) critical.push("JobStream sync is stale or failing.");
  if (syncError) critical.push("The latest worker or sync error is not cleared.");
  if (!adSenseId && affiliateConfig.configured.length === 0) {
    critical.push("No passive monetization channel is configured.");
  }
  if (!adSenseId) warnings.push("AdSense publisher ID is not configured.");
  if (affiliateConfig.configured.length === 0) warnings.push("No affiliate resource URLs are configured.");
  if (pendingPaidOrders.length) warnings.push(`${pendingPaidOrders.length} legacy paid order(s) are pending review while paid sales are paused.`);

  return {
    ok: critical.length === 0,
    generatedAt: now.toISOString(),
    critical,
    warnings,
    health: {
      worker: {
        healthy: workerHealthy,
        lastHeartbeatAt: syncState.lastWorkerHeartbeatAt ?? null,
        heartbeatAgeSeconds: workerHeartbeatAgeSeconds
      },
      freshness: {
        healthy: freshnessHealthy,
        lastSuccessAt: syncState.jobstreamLastSuccessAt ?? null,
        syncAgeSeconds: jobSyncAgeSeconds,
        lastAttemptAt: syncState.jobstreamLastAttemptAt ?? null,
        lastError: syncError || null
      }
    },
    jobs: {
      total: jobs.length,
      live: jobs.filter((job) => job.status === "live").length,
      failedApplyLinks: jobs.filter((job) => job.status === "live" && job.applyLinkStatus === "failed").length
    },
    monetization: {
      mode: "ads_affiliate",
      adSenseConfigured: Boolean(adSenseId),
      affiliateLinksConfigured: affiliateConfig.configured.length,
      affiliateLinks: affiliateConfig.links,
      paidOrdersPendingReview: pendingPaidOrders.length,
      sponsorPendingReview: pendingSponsors.length,
      affiliatePendingReview: pendingAffiliates.length,
      sponsorEventsLast7Days: sponsorSummary.last7Days,
      affiliateClicksLast7Days
    },
    reports: reportSummary,
    clientErrors: clientErrorSummary,
    syncState
  };
}

function affiliateLinkConfig() {
  const links = [
    { key: "ADTRACTION_AKASSA_URL", label: "a-kassa" },
    { key: "ADTRACTION_EDUCATION_URL", label: "education" },
    { key: "ADTRACTION_INCOME_INSURANCE_URL", label: "income-insurance" }
  ].map((link) => ({
    ...link,
    configured: Boolean(process.env[link.key]?.trim())
  }));

  return {
    links,
    configured: links.filter((link) => link.configured)
  };
}

async function readReportSummary() {
  const reports = await readJsonLines(reportsPath);
  const now = new Date();
  const last7Days = reports.filter((report) => ageDays(stringField(report, "createdAt"), now) <= 7);
  return {
    totalStored: reports.length,
    last7Days: last7Days.length,
    byType: countBy(last7Days, (report) => stringField(report, "reportType") || "unknown")
  };
}

async function readSponsorEventSummary() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await queryDatabase<{ eventType: string; count: number | string }>(`
    select event_type as "eventType", count(*)::int as count
    from sponsor_events
    where created_at >= $1
    group by event_type
  `, [since]);

  if (rows) {
    return {
      last7Days: rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
      byType: Object.fromEntries(rows.map((row) => [row.eventType, Number(row.count ?? 0)]))
    };
  }

  const events = await readJsonLines(sponsorEventsPath);
  const now = new Date();
  const last7Days = events.filter((event) => ageDays(stringField(event, "createdAt"), now) <= 7);
  return {
    last7Days: last7Days.length,
    byType: countBy(last7Days, (event) => stringField(event, "type") || "unknown")
  };
}

async function readClientErrorSummary() {
  const errors = await readJsonLines(clientErrorsPath);
  const now = new Date();
  const last24Hours = errors.filter((error) => ageDays(stringField(error, "createdAt"), now) <= 1);
  const last7Days = errors.filter((error) => ageDays(stringField(error, "createdAt"), now) <= 7);
  return {
    totalStored: errors.length,
    last24Hours: last24Hours.length,
    last7Days: last7Days.length,
    byType: countBy(last7Days, (error) => stringField(error, "type") || "unknown"),
    recent: last7Days.slice(-5).reverse().map((error) => ({
      createdAt: stringField(error, "createdAt") || null,
      type: stringField(error, "type") || "unknown",
      message: stringField(error, "message"),
      path: stringField(error, "path"),
      userAgent: stringField(error, "userAgent")
    }))
  };
}

async function readJsonLines(filePath: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
        } catch {
          return {};
        }
      });
  } catch {
    return [];
  }
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function ageDays(value: string | undefined, now: Date) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? (now.getTime() - time) / 86_400_000 : Number.POSITIVE_INFINITY;
}
