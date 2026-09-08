import type { GoogleAdPolicy } from "@/lib/ad-eligibility";
import { getManualAdSlotId, isAdSenseManualAdsEnabled } from "@/lib/adsense";

export function withManualAdSlotIds(policy: GoogleAdPolicy): GoogleAdPolicy {
  if (!policy.googleAdsEligible) return policy;

  if (!isAdSenseManualAdsEnabled()) {
    return {
      ...policy,
      googleAdsEligible: false,
      reason: "manual_ads_disabled",
      slots: [],
      slotIds: {}
    };
  }

  const slotIds = Object.fromEntries(
    policy.slots
      .map((slot) => [slot, getManualAdSlotId(slot)] as const)
      .filter(([, slotId]) => Boolean(slotId))
  );
  const slots = policy.slots.filter((slot) => Boolean(slotIds[slot]));

  if (!slots.length) {
    return {
      ...policy,
      googleAdsEligible: false,
      reason: "manual_ad_slots_missing",
      slots: [],
      slotIds: {}
    };
  }

  return {
    ...policy,
    slots,
    slotIds
  };
}
