import { NextResponse } from "next/server";
import { normalizeText } from "@/lib/classifiers";
import { getLiveJobs } from "@/lib/store";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

type SuggestionType = "title" | "location";

const suggestionCache = new Map<string, { expiresAt: number; payload: SuggestionPayload }>();
const suggestionCacheTtlMs = 10 * 60 * 1000;
const maxSuggestionCacheEntries = 200;

const swedishRegions = [
  "Blekinge län",
  "Dalarnas län",
  "Gotlands län",
  "Gävleborgs län",
  "Hallands län",
  "Jämtlands län",
  "Jönköpings län",
  "Kalmar län",
  "Kronobergs län",
  "Norrbottens län",
  "Skåne län",
  "Stockholms län",
  "Södermanlands län",
  "Uppsala län",
  "Värmlands län",
  "Västerbottens län",
  "Västernorrlands län",
  "Västmanlands län",
  "Västra Götalands län",
  "Örebro län",
  "Östergötlands län"
];

const commonSwedishTowns = [
  "Stockholm",
  "Göteborg",
  "Malmö",
  "Uppsala",
  "Västerås",
  "Örebro",
  "Linköping",
  "Helsingborg",
  "Jönköping",
  "Norrköping",
  "Lund",
  "Umeå",
  "Gävle",
  "Borås",
  "Södertälje",
  "Eskilstuna",
  "Halmstad",
  "Växjö",
  "Karlstad",
  "Sundsvall",
  "Luleå",
  "Trollhättan",
  "Östersund",
  "Borlänge",
  "Falun",
  "Kalmar",
  "Kristianstad",
  "Skövde",
  "Karlskrona",
  "Nyköping"
];

interface SuggestionPayload {
  type: SuggestionType;
  query: string;
  suggestions: string[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = parseSuggestionType(url.searchParams.get("type"));
  const query = cleanQuery(url.searchParams.get("q"));
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") ?? 8)));
  const cacheKey = `${type}|${query}|${limit}`;
  const cached = getCachedSuggestion(cacheKey);
  if (cached) return jsonResponse(cached, "HIT");

  const jobs = await getLiveJobs();
  const suggestions = type === "location"
    ? buildLocationSuggestions(jobs, query, limit)
    : buildTitleSuggestions(jobs, query, limit);
  const payload = { type, query, suggestions };

  setCachedSuggestion(cacheKey, payload);
  return jsonResponse(payload, "MISS");
}

function buildTitleSuggestions(jobs: Job[], query: string, limit: number) {
  const buckets = new Map<string, { label: string; count: number; bestScore: number }>();

  for (const job of jobs) {
    for (const candidate of [job.titleCanonical, job.titleNormalized, job.title, job.titleCategory]) {
      addSuggestionCandidate(buckets, candidate, query, titleScore(candidate, query, job));
    }
  }

  return rankSuggestions(buckets, limit);
}

function buildLocationSuggestions(jobs: Job[], query: string, limit: number) {
  const buckets = new Map<string, { label: string; count: number; bestScore: number }>();

  for (const location of [...swedishRegions, ...commonSwedishTowns]) {
    addSuggestionCandidate(buckets, location, query, locationScore(location, query, 20));
  }

  for (const job of jobs) {
    addSuggestionCandidate(buckets, job.municipality, query, locationScore(job.municipality, query, 35));
    addSuggestionCandidate(buckets, job.region, query, locationScore(job.region, query, 25));
  }

  return rankSuggestions(buckets, limit);
}

function addSuggestionCandidate(
  buckets: Map<string, { label: string; count: number; bestScore: number }>,
  value: string | undefined,
  query: string,
  score: number
) {
  const label = cleanLabel(value);
  if (!label || score <= 0) return;

  const key = normalizeText(label);
  const bucket = buckets.get(key) ?? { label, count: 0, bestScore: 0 };
  bucket.count += 1;
  bucket.bestScore = Math.max(bucket.bestScore, score);
  buckets.set(key, bucket);
}

function titleScore(value: string | undefined, query: string, job: Job) {
  const label = cleanLabel(value);
  if (!label) return 0;
  const normalizedLabel = normalizeText(label);
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return Number(job.trustScore ?? 50) / 10;
  if (normalizedLabel.startsWith(normalizedQuery)) return 120;
  if (normalizedLabel.split(/[\s/-]+/).some((part) => part.startsWith(normalizedQuery))) return 95;
  if (normalizedLabel.includes(normalizedQuery)) return 70;
  return 0;
}

function locationScore(value: string | undefined, query: string, base: number) {
  const label = cleanLabel(value);
  if (!label) return 0;
  const normalizedLabel = normalizeText(label);
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return base;
  if (normalizedLabel.startsWith(normalizedQuery)) return base + 90;
  if (normalizedLabel.includes(normalizedQuery)) return base + 55;
  return 0;
}

function rankSuggestions(buckets: Map<string, { label: string; count: number; bestScore: number }>, limit: number) {
  return Array.from(buckets.values())
    .sort((a, b) => b.bestScore - a.bestScore || b.count - a.count || a.label.localeCompare(b.label, "sv"))
    .slice(0, limit)
    .map((bucket) => bucket.label);
}

function parseSuggestionType(value: string | null): SuggestionType {
  return value === "location" ? "location" : "title";
}

function cleanQuery(value: string | null) {
  return String(value ?? "").trim().slice(0, 80);
}

function cleanLabel(value: string | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+[,|-]\s+.*$/g, "")
    .trim()
    .slice(0, 80);
}

function getCachedSuggestion(key: string) {
  const cached = suggestionCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt < Date.now()) {
    suggestionCache.delete(key);
    return undefined;
  }
  suggestionCache.delete(key);
  suggestionCache.set(key, cached);
  return cached.payload;
}

function setCachedSuggestion(key: string, payload: SuggestionPayload) {
  suggestionCache.set(key, { expiresAt: Date.now() + suggestionCacheTtlMs, payload });
  while (suggestionCache.size > maxSuggestionCacheEntries) {
    const oldestKey = suggestionCache.keys().next().value;
    if (!oldestKey) break;
    suggestionCache.delete(oldestKey);
  }
}

function jsonResponse(payload: SuggestionPayload, cacheStatus: "HIT" | "MISS") {
  return NextResponse.json(payload, {
    headers: {
      "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600",
      "x-suggestion-cache": cacheStatus
    }
  });
}
