import type { ManualAdSlot } from "@/lib/adsense";
import type { SyncState } from "@/lib/types";

export type AdEligibleRoute = "home" | "municipality" | "role_location" | "remote";

export interface GoogleAdPolicy {
  googleAdsEligible: boolean;
  reason?: string;
  slots: ManualAdSlot[];
  minimumVisibleJobs: number;
  slotIds?: Partial<Record<ManualAdSlot, string>>;
}

export interface GoogleAdPolicyInput {
  route: AdEligibleRoute;
  visibleJobCount: number;
  indexable: boolean;
  syncState: SyncState;
  now?: Date;
}

const staleSyncHours = 72;
const thresholds: Record<AdEligibleRoute, number> = {
  home: 25,
  municipality: 10,
  role_location: 10,
  remote: 10
};

export function buildGoogleAdPolicy(input: GoogleAdPolicyInput): GoogleAdPolicy {
  if (!input.indexable) return disabled("page_not_indexable");

  const minimumJobs = thresholds[input.route];
  if (input.visibleJobCount < minimumJobs) return disabled(`too_few_jobs:${input.visibleJobCount}/${minimumJobs}`);

  if (isSyncStateStale(input.syncState, input.now)) return disabled("stale_job_data");

  return {
    googleAdsEligible: true,
    minimumVisibleJobs: minimumJobs,
    slots: slotsForVisibleJobCount(input.visibleJobCount),
    slotIds: {}
  };
}

export function isSyncStateStale(syncState: SyncState, now = new Date()) {
  const lastSuccess = parseDate(syncState.jobstreamLastSuccessAt);
  if (!lastSuccess) return true;
  return now.getTime() - lastSuccess.getTime() > staleSyncHours * 60 * 60 * 1000;
}

export function minimumAdJobsForRoute(route: AdEligibleRoute) {
  return thresholds[route];
}

function disabled(reason: string): GoogleAdPolicy {
  return {
    googleAdsEligible: false,
    reason,
    minimumVisibleJobs: Number.POSITIVE_INFINITY,
    slots: [],
    slotIds: {}
  };
}

function slotsForVisibleJobCount(count: number): ManualAdSlot[] {
  const slots: ManualAdSlot[] = ["results_top"];
  if (count >= 25) slots.push("results_after_8");
  if (count >= 50) slots.push("results_after_24");
  if (count >= 80) slots.push("results_after_48");
  if (count >= 100) slots.push("results_bottom");
  return slots;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
