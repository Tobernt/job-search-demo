import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const sourceNormalizedPath = path.join(process.cwd(), "data", "source-normalized-jobs.json");

export async function GET() {
  const store = await readNormalized();
  const accepted = store.accepted ?? [];
  const duplicates = store.duplicates ?? [];
  const rejected = store.rejected ?? [];

  return NextResponse.json({
    ok: true,
    updatedAt: store.updatedAt ?? null,
    source: store.source ?? null,
    summary: store.summary ?? {
      accepted: accepted.length,
      duplicates: duplicates.length,
      rejected: rejected.length
    },
    accepted: accepted.slice(0, 25).map((job) => ({
      id: job.id,
      source: job.source,
      sourceAdId: job.sourceAdId,
      title: job.title,
      titleCanonical: job.titleCanonical,
      titleCategory: job.titleCategory,
      employerName: job.employerName,
      municipality: job.municipality,
      seniority: job.seniority,
      trustScore: job.trustScore,
      applyUrl: job.applyUrl
    })),
    duplicates: duplicates.slice(0, 25).map((entry) => ({
      reason: entry.reason,
      candidateId: entry.candidateId,
      job: entry.job
    })),
    rejected: rejected.slice(0, 25)
  });
}

async function readNormalized(): Promise<{
  updatedAt?: string;
  source?: string;
  summary?: Record<string, unknown>;
  accepted?: Array<Record<string, unknown>>;
  duplicates?: Array<Record<string, unknown>>;
  rejected?: Array<Record<string, unknown>>;
}> {
  try {
    return JSON.parse(await readFile(sourceNormalizedPath, "utf8"));
  } catch {
    return { accepted: [], duplicates: [], rejected: [] };
  }
}
