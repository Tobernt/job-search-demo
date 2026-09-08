export interface LocalJobState {
  viewed: string[];
  saved: string[];
  applied: string[];
  hidden: string[];
  reported: string[];
}

export const emptyLocalJobState: LocalJobState = {
  viewed: [],
  saved: [],
  applied: [],
  hidden: [],
  reported: []
};

export const JOB_STATE_STORAGE_KEY = "jobsearchdemo.jobState.v1";
const LEGACY_STORAGE_KEYS = ["jobsearchdemo.jobState.v1"];

export function readLocalJobState(): LocalJobState {
  if (typeof window === "undefined") return emptyLocalJobState;
  try {
    const raw = window.localStorage.getItem(JOB_STATE_STORAGE_KEY) ?? readLegacyStorageValue();
    const parsed = JSON.parse(raw ?? "{}") as Partial<LocalJobState>;
    const normalized = {
      viewed: normalizeList(parsed.viewed),
      saved: normalizeList(parsed.saved),
      applied: normalizeList(parsed.applied),
      hidden: normalizeList(parsed.hidden),
      reported: normalizeList(parsed.reported)
    };
    if (!window.localStorage.getItem(JOB_STATE_STORAGE_KEY) && raw) writeLocalJobState(normalized);
    return normalized;
  } catch {
    return emptyLocalJobState;
  }
}

export function writeLocalJobState(state: LocalJobState) {
  try {
    window.localStorage.setItem(JOB_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private, restricted, or full mobile browsers.
  }
}

export function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function addId(list: string[], id: string) {
  return list.includes(id) ? list : [...list, id];
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === "string"))) : [];
}

function readLegacyStorageValue() {
  for (const key of LEGACY_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}
