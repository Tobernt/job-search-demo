import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendClientError } from "@/lib/store";

export const dynamic = "force-dynamic";

const dataDir = path.join(process.cwd(), "data");
const clientErrorsPath = path.join(dataDir, "client-errors.jsonl");
const maxErrorsPerHour = Math.max(1, Number(process.env.CLIENT_ERROR_RATE_LIMIT_PER_HOUR ?? 20));
const retentionMs = Math.max(1, Number(process.env.CLIENT_ERROR_RETENTION_DAYS ?? 7)) * 24 * 60 * 60 * 1000;

interface StoredClientError {
  reporterKey?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const message = sanitizeText(payload.message, 500);

  if (!message) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  const key = await reporterKey(request);
  const now = new Date();
  const recentErrors = await pruneClientErrors(await readClientErrors(), now);
  const recentForReporter = recentErrors.filter((error) =>
    error.reporterKey === key && now.getTime() - new Date(error.createdAt ?? 0).getTime() <= 60 * 60 * 1000
  );
  if (recentForReporter.length >= maxErrorsPerHour) {
    return NextResponse.json({ ok: true, rateLimited: true });
  }

  await appendClientError({
    reporterKey: key,
    type: sanitizeText(payload.type, 80) || "error",
    message,
    stack: sanitizeText(payload.stack, 3000),
    source: sanitizeText(payload.source, 500),
    path: sanitizeText(payload.path, 500),
    userAgent: sanitizeText(payload.userAgent, 500),
    viewport: sanitizeText(payload.viewport, 80),
    line: numericValue(payload.line),
    column: numericValue(payload.column)
  });

  return NextResponse.json({ ok: true });
}

async function readClientErrors() {
  try {
    const raw = await readFile(clientErrorsPath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as StoredClientError;
        } catch {
          return {};
        }
      });
  } catch {
    return [];
  }
}

async function pruneClientErrors(errors: StoredClientError[], now: Date) {
  const kept = errors.filter((error) => {
    const createdAt = new Date(String(error.createdAt ?? 0)).getTime();
    return Number.isFinite(createdAt) && now.getTime() - createdAt <= retentionMs;
  });
  if (kept.length !== errors.length) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(clientErrorsPath, kept.map((error) => JSON.stringify(error)).join("\n") + (kept.length ? "\n" : ""), "utf8");
  }
  return kept;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
