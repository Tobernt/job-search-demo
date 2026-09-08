import { NextResponse } from "next/server";
import { appendApplyClick, findJob } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const jobId = typeof payload.jobId === "string" ? payload.jobId : "";
  const job = await findJob(jobId);

  if (!job) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await appendApplyClick({
    jobId: job.id,
    source: job.source,
    sourceAdId: job.sourceAdId,
    destinationDomain: job.applyDomain,
    applyType: job.applyType,
    workMode: job.workMode,
    classificationVersion: job.classificationVersion
  });

  return NextResponse.json({ ok: true });
}
