import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendReport } from "@/lib/store";

export const dynamic = "force-dynamic";

const dataDir = path.join(process.cwd(), "data");
const reportsPath = path.join(dataDir, "reports.jsonl");
const maxReportsPerHour = Math.max(1, Number(process.env.REPORT_RATE_LIMIT_PER_HOUR ?? 5));
const retentionMs = Math.max(1, Number(process.env.REPORT_RETENTION_DAYS ?? 7)) * 24 * 60 * 60 * 1000;
const duplicateWindowMs = 24 * 60 * 60 * 1000;
const allowedReportTypes = new Set([
  "expired",
  "duplicate",
  "wrong_role",
  "wrong_work_mode",
  "broken_apply_link",
  "suspicious"
]);

interface StoredReport {
  jobId?: string;
  reportType?: string;
  reporterKey?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const reportType = typeof payload.reportType === "string" ? payload.reportType : "";
  const jobId = typeof payload.jobId === "string" ? payload.jobId.trim() : "";

  if (typeof payload.website === "string" && payload.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  if (!jobId || !allowedReportTypes.has(reportType)) {
    return NextResponse.json({ ok: false, error: "jobId and valid reportType are required" }, { status: 400 });
  }

  const key = await reporterKey(request);
  const now = new Date();
  const reports = await pruneReports(await readReports(), now);
  const recentForReporter = reports.filter((report) =>
    report.reporterKey === key && now.getTime() - new Date(report.createdAt ?? 0).getTime() <= 60 * 60 * 1000
  );
  if (recentForReporter.length >= maxReportsPerHour) {
    return NextResponse.json({ ok: false, error: "Too many reports. Try again later." }, { status: 429 });
  }

  const duplicate = reports.some((report) =>
    report.reporterKey === key
    && report.jobId === jobId
    && report.reportType === reportType
    && now.getTime() - new Date(report.createdAt ?? 0).getTime() <= duplicateWindowMs
  );
  if (duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await appendReport({
    jobId,
    reportType,
    reportText: sanitizeReportText(payload.reportText),
    reporterKey: key
  });

  return NextResponse.json({ ok: true });
}

async function readReports() {
  try {
    const raw = await readFile(reportsPath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as StoredReport;
        } catch {
          return {};
        }
      });
  } catch {
    return [];
  }
}

async function pruneReports(reports: StoredReport[], now: Date) {
  const kept = reports.filter((report) => {
    const createdAt = new Date(String(report.createdAt ?? 0)).getTime();
    return Number.isFinite(createdAt) && now.getTime() - createdAt <= retentionMs;
  });
  if (kept.length !== reports.length) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(reportsPath, kept.map((report) => JSON.stringify(report)).join("\n") + (kept.length ? "\n" : ""), "utf8");
  }
  return kept;
}

function sanitizeReportText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function reporterKey(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const input = `${forwarded}|${userAgent}`;
  if (!input.trim()) return "unknown";

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
