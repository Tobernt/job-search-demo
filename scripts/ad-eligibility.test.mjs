import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/ad-eligibility.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
const {
  buildGoogleAdPolicy,
  isSyncStateStale,
  minimumAdJobsForRoute
} = await import(moduleUrl);

const now = new Date("2026-06-05T12:00:00.000Z");
const freshSyncState = { jobstreamLastSuccessAt: "2026-06-05T09:00:00.000Z" };
const staleSyncState = { jobstreamLastSuccessAt: "2026-05-30T09:00:00.000Z" };

test("manual Google ads require an indexable page", () => {
  const policy = buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: 100,
    indexable: false,
    syncState: freshSyncState,
    now
  });

  assert.equal(policy.googleAdsEligible, false);
  assert.equal(policy.reason, "page_not_indexable");
  assert.deepEqual(policy.slots, []);
});

test("manual Google ads require route-specific result thresholds", () => {
  assert.equal(minimumAdJobsForRoute("home"), 25);
  assert.equal(minimumAdJobsForRoute("municipality"), 10);
  assert.equal(minimumAdJobsForRoute("role_location"), 10);
  assert.equal(minimumAdJobsForRoute("remote"), 10);

  const policy = buildGoogleAdPolicy({
    route: "municipality",
    visibleJobCount: 9,
    indexable: true,
    syncState: freshSyncState,
    now
  });

  assert.equal(policy.googleAdsEligible, false);
  assert.equal(policy.reason, "too_few_jobs:9/10");
});

test("manual Google ads are disabled when sync data is stale", () => {
  assert.equal(isSyncStateStale(staleSyncState, now), true);

  const policy = buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: 100,
    indexable: true,
    syncState: staleSyncState,
    now
  });

  assert.equal(policy.googleAdsEligible, false);
  assert.equal(policy.reason, "stale_job_data");
});

test("eligible pages receive density-based manual slots from visible inventory", () => {
  const minimumPolicy = buildGoogleAdPolicy({
    route: "municipality",
    visibleJobCount: 10,
    indexable: true,
    syncState: freshSyncState,
    now
  });
  assert.equal(minimumPolicy.googleAdsEligible, true);
  assert.deepEqual(minimumPolicy.slots, ["results_top"]);

  const twoSlotPolicy = buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: 25,
    indexable: true,
    syncState: freshSyncState,
    now
  });
  assert.equal(twoSlotPolicy.googleAdsEligible, true);
  assert.deepEqual(twoSlotPolicy.slots, ["results_top", "results_after_8"]);

  const threeSlotPolicy = buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: 50,
    indexable: true,
    syncState: freshSyncState,
    now
  });
  assert.equal(threeSlotPolicy.googleAdsEligible, true);
  assert.deepEqual(threeSlotPolicy.slots, ["results_top", "results_after_8", "results_after_24"]);

  const fullPagePolicy = buildGoogleAdPolicy({
    route: "home",
    visibleJobCount: 100,
    indexable: true,
    syncState: freshSyncState,
    now
  });
  assert.equal(fullPagePolicy.googleAdsEligible, true);
  assert.deepEqual(fullPagePolicy.slots, ["results_top", "results_after_8", "results_after_24", "results_after_48", "results_bottom"]);
});
