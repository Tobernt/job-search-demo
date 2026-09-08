import { NextRequest, NextResponse } from "next/server";
import { getSponsorById } from "@/lib/sponsors";
import { appendSponsorEvent } from "@/lib/store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sponsor = await getSponsorById(id);
  const placement = request.nextUrl.searchParams.get("placement") ?? "unknown";
  const creativeId = request.nextUrl.searchParams.get("creative");
  const siteUrl = process.env.PUBLIC_SITE_URL ?? request.nextUrl.origin;

  if (!sponsor) {
    const response = NextResponse.redirect(new URL("/annonser", siteUrl));
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  await appendSponsorEvent({
    type: "click",
    sponsorId: sponsor.id,
    placement,
    source: "redirect"
  });

  const response = NextResponse.redirect(resolveDestination(resolveSponsorDestination(sponsor, creativeId), siteUrl));
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

function resolveSponsorDestination(sponsor: NonNullable<Awaited<ReturnType<typeof getSponsorById>>>, creativeId: string | null) {
  const creativeDestination = sponsor.creativeVariants?.find((creative) => creative.id === creativeId)?.destinationUrl;
  return creativeDestination || sponsor.destinationUrl;
}

function resolveDestination(destination: string, siteUrl: string) {
  const resolved = resolveConfiguredDestination(destination);
  try {
    return new URL(resolved);
  } catch {
    return new URL(resolved, siteUrl);
  }
}

function resolveConfiguredDestination(destination: string) {
  if (!destination.startsWith("env:")) return destination;

  const [key, fallback = "/annonser"] = destination.slice(4).split("|", 2);
  return process.env[key]?.trim() || fallback;
}
