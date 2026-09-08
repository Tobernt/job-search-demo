import { normalizeText } from "./classifiers";
import { swedishLocalities } from "@/data/swedish-localities";
import type { Job } from "./types";

const kilometersPerMil = 10;
const regionSuffixPattern = /\s+l[aä]n$/i;

interface Point {
  lat: number;
  lon: number;
}

interface ResolvedLocation extends Point {
  type: "locality" | "municipality";
  label: string;
}

const localityIndex = buildLocalityIndex();
const municipalityIndex = buildMunicipalityIndex();

export function hasRadiusSearch(location: string | undefined, radiusMil: number | undefined) {
  return Boolean(resolveSearchLocation(location)) && Number(radiusMil) > 0;
}

export function filterJobsByDistance(jobs: Job[], location: string | undefined, radiusMil: number | undefined) {
  const center = resolveSearchLocation(location);
  const radiusKm = Number(radiusMil) * kilometersPerMil;
  if (!center || !Number.isFinite(radiusKm) || radiusKm <= 0) return jobs;

  return jobs.filter((job) => {
    const point = resolveJobLocation(job);
    if (!point) return false;
    return distanceKm(center, point) <= radiusKm;
  });
}

export function distanceKmFromSearchLocation(job: Job, location: string | undefined) {
  const center = resolveSearchLocation(location);
  const point = resolveJobLocation(job);
  return center && point ? distanceKm(center, point) : null;
}

function resolveSearchLocation(value: string | undefined): ResolvedLocation | null {
  const key = locationKey(value);
  if (!key) return null;
  return localityIndex.get(key) ?? municipalityIndex.get(key) ?? null;
}

function resolveJobLocation(job: Job): Point | null {
  const municipality = municipalityIndex.get(locationKey(job.municipality));
  if (municipality) return municipality;

  const locality = localityIndex.get(locationKey(job.municipality));
  if (locality) return locality;

  const addressKey = locationKey(job.workplaceAddress);
  if (addressKey) {
    for (const [key, point] of localityIndex) {
      if (addressKey.includes(key)) return point;
    }
  }

  return null;
}

function buildLocalityIndex() {
  const index = new Map<string, ResolvedLocation>();

  for (const locality of swedishLocalities) {
    const key = locationKey(locality.name);
    if (!key || index.has(key)) continue;
    index.set(key, {
      type: "locality",
      label: locality.name,
      lat: locality.lat,
      lon: locality.lon
    });
  }

  return index;
}

function buildMunicipalityIndex() {
  const buckets = new Map<string, { label: string; lat: number; lon: number; count: number; exact?: Point }>();

  for (const locality of swedishLocalities) {
    const key = locationKey(locality.municipality);
    if (!key) continue;

    const bucket = buckets.get(key) ?? {
      label: locality.municipality,
      lat: 0,
      lon: 0,
      count: 0
    };
    bucket.lat += locality.lat;
    bucket.lon += locality.lon;
    bucket.count += 1;
    if (locationKey(locality.name) === key) {
      bucket.exact = { lat: locality.lat, lon: locality.lon };
    }
    buckets.set(key, bucket);
  }

  const index = new Map<string, ResolvedLocation>();
  for (const [key, bucket] of buckets) {
    const point = bucket.exact ?? {
      lat: bucket.lat / bucket.count,
      lon: bucket.lon / bucket.count
    };
    index.set(key, {
      type: "municipality",
      label: bucket.label,
      lat: point.lat,
      lon: point.lon
    });
  }

  return index;
}

function locationKey(value: string | undefined) {
  return normalizeText(value).replace(regionSuffixPattern, "").trim();
}

function distanceKm(a: Point, b: Point) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}
