import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const sourceDiscoveryPath = path.join(process.cwd(), "data", "source-discovery.json");

export async function GET() {
  const discovery = await readDiscovery();
  const sources = discovery.sources ?? [];
  const counts = sources.reduce<Record<string, number>>((acc, source) => {
    const status = typeof source.status === "string" ? source.status : "unknown";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    updatedAt: discovery.updatedAt ?? null,
    total: sources.length,
    counts,
    candidates: sources
      .filter((source) => source.status === "candidate")
      .slice(0, 25)
      .map((source) => ({
        id: source.id,
        name: source.name,
        careerUrl: source.careerUrl,
        atsVendor: source.atsVendor,
        crawlerMode: source.crawlerMode,
        sourceQuality: source.sourceQuality,
        checkedAt: source.checkedAt
      }))
  });
}

async function readDiscovery(): Promise<{ updatedAt?: string; sources?: Array<Record<string, unknown>> }> {
  try {
    return JSON.parse(await readFile(sourceDiscoveryPath, "utf8"));
  } catch {
    return { updatedAt: undefined, sources: [] };
  }
}
