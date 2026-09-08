import { NextResponse } from "next/server";
import { readSyncState } from "@/lib/store";

export const dynamic = "force-dynamic";

const workerHeartbeatMaxAgeSeconds = 30 * 60;
const jobSyncMaxAgeSeconds = 6 * 60 * 60;

export async function GET() {
  const syncState = await readSyncState();
  const now = Date.now();
  const heartbeatAt = syncState.lastWorkerHeartbeatAt ? new Date(syncState.lastWorkerHeartbeatAt).getTime() : 0;
  const successAt = syncState.jobstreamLastSuccessAt ? new Date(syncState.jobstreamLastSuccessAt).getTime() : 0;
  const heartbeatAgeSeconds = heartbeatAt ? Math.round((now - heartbeatAt) / 1000) : null;
  const syncAgeSeconds = successAt ? Math.round((now - successAt) / 1000) : null;
  const syncError = syncState.lastSyncError ?? syncState.lastWorkerError ?? "";
  const workerHealthy = Boolean(
    heartbeatAt &&
    heartbeatAgeSeconds !== null &&
    heartbeatAgeSeconds <= workerHeartbeatMaxAgeSeconds &&
    !syncState.lastWorkerError
  );
  const freshnessHealthy = Boolean(
    successAt &&
    syncAgeSeconds !== null &&
    syncAgeSeconds <= jobSyncMaxAgeSeconds &&
    !syncError
  );

  return NextResponse.json({
    ok: workerHealthy && freshnessHealthy,
    worker: {
      healthy: workerHealthy,
      heartbeatAgeSeconds
    },
    freshness: {
      healthy: freshnessHealthy,
      syncAgeSeconds,
      lastError: syncError || null
    },
    syncState
  }, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
