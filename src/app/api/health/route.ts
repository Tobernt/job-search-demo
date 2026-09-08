import { NextResponse } from "next/server";
import { readJobs, readSyncState } from "@/lib/store";

export const dynamic = "force-dynamic";

const workerHeartbeatMaxAgeSeconds = 30 * 60;
const jobSyncMaxAgeSeconds = 6 * 60 * 60;

export async function GET() {
  const jobs = await readJobs();
  const syncState = await readSyncState();
  const now = Date.now();
  const heartbeatAt = syncState.lastWorkerHeartbeatAt ? new Date(syncState.lastWorkerHeartbeatAt).getTime() : 0;
  const successAt = syncState.jobstreamLastSuccessAt ? new Date(syncState.jobstreamLastSuccessAt).getTime() : 0;
  const workerHeartbeatAgeSeconds = heartbeatAt ? Math.round((now - heartbeatAt) / 1000) : null;
  const jobSyncAgeSeconds = successAt ? Math.round((now - successAt) / 1000) : null;
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
  return NextResponse.json({
    ok: workerHealthy && freshnessHealthy,
    jobs: jobs.length,
    liveJobs: jobs.filter((job) => job.status === "live").length,
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
      inProgressSince: syncState.jobstreamInProgressSince ?? null,
      lastError: syncError || null
    },
    syncState
  });
}
