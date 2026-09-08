import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const sourceJobCandidatesPath = path.join(process.cwd(), "data", "source-job-candidates.json");

export async function GET() {
  const store = await readCandidates();
  const candidates = store.candidates ?? [];
  const bySource = candidates.reduce<Record<string, number>>((acc, candidate) => {
    const sourceName = typeof candidate.sourceName === "string" ? candidate.sourceName : "unknown";
    acc[sourceName] = (acc[sourceName] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    updatedAt: store.updatedAt ?? null,
    total: candidates.length,
    bySource,
    candidates: candidates.slice(0, 50).map((candidate) => ({
      id: candidate.id,
      sourceId: candidate.sourceId,
      sourceName: candidate.sourceName,
      atsVendor: candidate.atsVendor,
      title: candidate.title,
      jobUrl: candidate.jobUrl,
      candidateType: candidate.candidateType,
      sourceAdId: candidate.sourceAdId,
      confidence: candidate.confidence,
      reason: candidate.reason,
      discoveredAt: candidate.discoveredAt
    }))
  });
}

async function readCandidates(): Promise<{ updatedAt?: string; candidates?: Array<Record<string, unknown>> }> {
  try {
    return JSON.parse(await readFile(sourceJobCandidatesPath, "utf8"));
  } catch {
    return { updatedAt: undefined, candidates: [] };
  }
}
