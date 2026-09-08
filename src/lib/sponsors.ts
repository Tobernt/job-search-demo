import sponsorConfig from "@/data/sponsors.json";
import { getApprovedSponsorCampaigns } from "./monetization-store";
import type { WorkMode } from "./types";

export type SponsorPlacement = "top_search" | "empty_state" | "apply_redirect";

export interface SponsorCreativeVariant {
  id: string;
  imageUrl: string;
  imageAlt?: string;
  destinationUrl?: string;
}

export interface SponsorAd {
  id: string;
  label: "Annons" | "Sponsrad";
  category: string;
  placement: SponsorPlacement;
  headline: string;
  body: string;
  cta: string;
  destinationUrl: string;
  disclosure: string;
  imageUrl?: string;
  imageAlt?: string;
  creativeVariants?: SponsorCreativeVariant[];
  activeFrom: string;
  activeTo: string;
  priority: number;
  allowedContexts: {
    categories?: string[];
    workModes?: Array<WorkMode | "all">;
    locations?: string[];
  };
}

export interface SponsorContext {
  placement: SponsorPlacement;
  category?: string;
  workMode?: WorkMode | "all";
  location?: string;
  resultCount?: number;
}

const sponsors = sponsorConfig as SponsorAd[];
const sponsorCardsEnabled = process.env.SPONSOR_CARDS_ENABLED === "true";

export async function getSponsorById(id: string) {
  if (!sponsorCardsEnabled) return undefined;
  const databaseSponsor = (await getApprovedSponsorCampaigns()).find((sponsor) => sponsor.id === id);
  if (databaseSponsor && !isRemovedSponsor(databaseSponsor as SponsorAd)) return databaseSponsor as SponsorAd;
  return sponsors.find((sponsor) => sponsor.id === id && !isRemovedSponsor(sponsor));
}

export async function selectSponsor(context: SponsorContext) {
  if (!sponsorCardsEnabled) return undefined;

  const availableSponsors = [
    ...(await getApprovedSponsorCampaigns()),
    ...sponsors
  ] as SponsorAd[];

  const now = new Date();
  return availableSponsors
    .filter((sponsor) => !isRemovedSponsor(sponsor))
    .filter((sponsor) => sponsor.placement === context.placement)
    .filter((sponsor) => isActive(sponsor, now))
    .filter((sponsor) => contextMatches(sponsor, context))
    .sort((a, b) => scoreSponsor(b, context) - scoreSponsor(a, context))[0];
}

export async function selectSponsorSlots(context: Omit<SponsorContext, "placement"> = {}) {
  return {
    topSearch: await selectSponsor({ ...context, placement: "top_search" }),
    emptyState: await selectSponsor({ ...context, placement: "empty_state" })
  };
}

function isActive(sponsor: SponsorAd, now: Date) {
  const activeFrom = new Date(sponsor.activeFrom);
  const activeTo = new Date(sponsor.activeTo);
  return activeFrom <= now && now <= activeTo;
}

function contextMatches(sponsor: SponsorAd, context: SponsorContext) {
  const allowed = sponsor.allowedContexts;

  if (allowed.categories?.length && !allowed.categories.includes("all")) {
    if (!context.category || !allowed.categories.includes(context.category)) return false;
  }

  if (allowed.workModes?.length && !allowed.workModes.includes("all")) {
    if (!context.workMode || !allowed.workModes.includes(context.workMode)) return false;
  }

  if (allowed.locations?.length) {
    const location = normalize(context.location);
    if (!location || !allowed.locations.some((item) => normalize(item) === location)) return false;
  }

  return true;
}

function scoreSponsor(sponsor: SponsorAd, context: SponsorContext) {
  let score = sponsor.priority;
  if (context.category && sponsor.allowedContexts.categories?.includes(context.category)) score += 15;
  if (context.workMode && sponsor.allowedContexts.workModes?.includes(context.workMode)) score += 8;
  if (context.location && sponsor.allowedContexts.locations?.some((item) => normalize(item) === normalize(context.location))) score += 8;
  if (context.resultCount === 0 && sponsor.placement === "empty_state") score += 30;
  return score;
}

function isRemovedSponsor(_sponsor: SponsorAd) {
  return false;
}

function normalize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
