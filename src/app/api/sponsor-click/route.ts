import { NextRequest } from "next/server";
import { appendSponsorEvent } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  await appendSponsorEvent({
    type: "click",
    sponsorId: typeof body.sponsorId === "string" ? body.sponsorId : "unknown",
    placement: typeof body.placement === "string" ? body.placement : "unknown",
    source: "api"
  });

  return Response.json({ ok: true });
}
