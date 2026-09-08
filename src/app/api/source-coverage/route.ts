import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const sourceCoveragePath = path.join(process.cwd(), "data", "source-coverage-report.json");

export async function GET() {
  const report = await readCoverage();
  return NextResponse.json({
    ok: true,
    ...report
  });
}

async function readCoverage(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(sourceCoveragePath, "utf8"));
  } catch {
    return {
      updatedAt: null,
      jobStore: {},
      sources: {},
      candidates: {},
      normalized: {}
    };
  }
}
