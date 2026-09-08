import { NextResponse } from "next/server";
import { toClientJobs } from "@/lib/client-jobs";
import { getLiveJobs } from "@/lib/store";
import { DEFAULT_SORT_MODE, filterJobs } from "@/lib/search";
import type { PostedWithin, SortMode } from "@/lib/search";
import { filterJobsByDistance, hasRadiusSearch } from "@/lib/location-radius";
import type { EmployerType, EmploymentExtent, Seniority, WorkMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const searchResponseCache = new Map<string, { expiresAt: number; payload: SearchPayload }>();
const searchCacheTtlMs = 5 * 60 * 1000;
const maxSearchCacheEntries = 100;

interface SearchPayload {
  total: number;
  page: number;
  limit: number;
  jobs: ReturnType<typeof toClientJobs>;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  const offset = (page - 1) * limit;
  const sort = parseSortMode(url.searchParams.get("sort"));
  const location = url.searchParams.get("location") ?? "";
  const distanceRadius = Number(url.searchParams.get("distanceRadius") ?? 0);
  const useRadiusSearch = hasRadiusSearch(location, distanceRadius);
  const cacheKey = buildSearchCacheKey(url, page, limit, sort);
  const cached = getCachedSearchPayload(cacheKey);
  if (cached) return jsonResponse(cached, Date.now() - startedAt, "HIT");

  const jobs = await getLiveJobs();
  const textFiltered = filterJobs(jobs, {
    query: url.searchParams.get("q") ?? "",
    location: useRadiusSearch ? "" : location,
    workMode: (url.searchParams.get("workMode") as WorkMode | "all") ?? "all",
    employerType: (url.searchParams.get("employerType") as EmployerType | "all") ?? "all",
    employmentExtent: (url.searchParams.get("employmentExtent") as EmploymentExtent | "all") ?? "all",
    seniority: (url.searchParams.get("seniority") as Seniority | "all") ?? "all",
    postedWithin: (url.searchParams.get("postedWithin") as PostedWithin | "all") ?? "all",
    distanceRadius,
    titleCategories: parseTitleCategories(url.searchParams),
    includeSales: url.searchParams.get("includeSales") === "true",
    includeIntermediaries: url.searchParams.get("includeIntermediaries") === "true",
    salaryOnly: url.searchParams.get("salaryOnly") === "true",
    language: url.searchParams.get("language") ?? ""
  }, sort);
  const filtered = useRadiusSearch ? filterJobsByDistance(textFiltered, location, distanceRadius) : textFiltered;

  const payload = {
    total: filtered.length,
    page,
    limit,
    jobs: toClientJobs(filtered.slice(offset, offset + limit))
  };
  setCachedSearchPayload(cacheKey, payload);
  return jsonResponse(payload, Date.now() - startedAt, "MISS");
}

function parseSortMode(value: string | null): SortMode {
  if (value === "best" || value === "newest" || value === "deadline") return value;
  return DEFAULT_SORT_MODE;
}

function buildSearchCacheKey(url: URL, page: number, limit: number, sort: SortMode) {
  const params = url.searchParams;
  return [
    params.get("q") ?? "",
    params.get("location") ?? "",
    params.get("distanceRadius") ?? "",
    params.get("workMode") ?? "all",
    params.get("employerType") ?? "all",
    params.get("employmentExtent") ?? "all",
    params.get("seniority") ?? "all",
    params.get("postedWithin") ?? "all",
    parseTitleCategories(params).join(",") || "all",
    params.get("includeSales") === "true",
    params.get("includeIntermediaries") === "true",
    params.get("salaryOnly") === "true",
    params.get("language") ?? "",
    sort,
    page,
    limit
  ].join("|");
}

function parseTitleCategories(params: URLSearchParams) {
  const values = [
    ...params.getAll("titleCategories"),
    params.get("titleCategory")
  ];
  return values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter((value) => value && value !== "all");
}

function getCachedSearchPayload(key: string) {
  const cached = searchResponseCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt < Date.now()) {
    searchResponseCache.delete(key);
    return undefined;
  }
  searchResponseCache.delete(key);
  searchResponseCache.set(key, cached);
  return cached.payload;
}

function setCachedSearchPayload(key: string, payload: SearchPayload) {
  searchResponseCache.set(key, { expiresAt: Date.now() + searchCacheTtlMs, payload });
  while (searchResponseCache.size > maxSearchCacheEntries) {
    const oldestKey = searchResponseCache.keys().next().value;
    if (!oldestKey) break;
    searchResponseCache.delete(oldestKey);
  }
}

function jsonResponse(payload: SearchPayload, durationMs: number, cacheStatus: "HIT" | "MISS") {
  return NextResponse.json(payload, {
    headers: {
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      "server-timing": `search;dur=${durationMs}`,
      "x-search-cache": cacheStatus
    }
  });
}
