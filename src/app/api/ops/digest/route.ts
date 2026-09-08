import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-auth";
import { buildOpsDigest } from "@/lib/ops-digest";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const digest = await buildOpsDigest();
  return NextResponse.json(digest, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
