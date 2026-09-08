import { NextRequest, NextResponse } from "next/server";
import { getAffiliateCampaignById, recordMonetizationEvent } from "@/lib/monetization-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getAffiliateCampaignById(id);
  const siteUrl = process.env.PUBLIC_SITE_URL ?? request.nextUrl.origin;

  if (!campaign || campaign.status !== "approved") {
    const response = NextResponse.redirect(new URL("/annonser", siteUrl));
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  await recordMonetizationEvent({
    eventType: "affiliate_click",
    entityType: "affiliate",
    entityId: campaign.id,
    source: "redirect",
    metadata: {
      placement: campaign.placement,
      category: campaign.category
    }
  });

  const response = NextResponse.redirect(resolveDestination(campaign.destinationUrl, siteUrl));
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

function resolveDestination(destination: string, siteUrl: string) {
  try {
    return new URL(destination);
  } catch {
    return new URL(destination, siteUrl);
  }
}
