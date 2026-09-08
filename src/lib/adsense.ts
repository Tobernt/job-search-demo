const defaultAdSenseClientId = "";
const defaultInFeedAdLayoutKey = "";

export function getAdSenseClientId() {
  return process.env.NEXT_PUBLIC_ADSENSE_ID || defaultAdSenseClientId;
}

export function isAdSenseAutoAdsEnabled() {
  return process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS === "true";
}

export function isAdSenseManualAdsEnabled() {
  return process.env.NEXT_PUBLIC_ADSENSE_MANUAL_ADS === "true";
}

export function isGoogleAdSenseCmpEnabled() {
  return process.env.NEXT_PUBLIC_ADSENSE_USE_GOOGLE_CMP !== "false";
}

export type ManualAdSlot = "results_top" | "results_after_8" | "results_after_24" | "results_after_48" | "results_bottom";

export function getManualAdSlotId(slot: ManualAdSlot) {
  const primarySlot = process.env.NEXT_PUBLIC_ADSENSE_TOP_SLOT || "";
  if (slot === "results_top") return process.env.NEXT_PUBLIC_ADSENSE_TOP_SLOT || "";
  if (slot === "results_after_8") return process.env.NEXT_PUBLIC_ADSENSE_AFTER_8_SLOT || process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT || process.env.NEXT_PUBLIC_ADSENSE_MID_SLOT || "";
  if (slot === "results_after_24") return process.env.NEXT_PUBLIC_ADSENSE_AFTER_24_SLOT || process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT || "";
  if (slot === "results_after_48") return process.env.NEXT_PUBLIC_ADSENSE_AFTER_48_SLOT || process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT || "";
  if (slot === "results_bottom") return process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT || primarySlot;
  return "";
}

export function getInFeedAdLayoutKey() {
  return process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_LAYOUT_KEY || defaultInFeedAdLayoutKey;
}
