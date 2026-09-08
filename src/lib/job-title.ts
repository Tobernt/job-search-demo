import type { Job } from "./types";

export function getDisplayTitle(job: Pick<Job, "title" | "titleCanonical">) {
  const title = job.title?.trim();
  const canonical = job.titleCanonical?.trim();
  if (title && canonical && shouldUseCanonicalTitle(title, canonical)) return canonical;
  return title || canonical || "Titel saknas";
}

export function getCanonicalTitleNote(job: Pick<Job, "title" | "titleCanonical">) {
  const title = job.title?.trim();
  const canonical = job.titleCanonical?.trim();
  if (!title || !canonical || !shouldUseCanonicalTitle(title, canonical)) return "";
  return title;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shouldUseCanonicalTitle(title: string, canonical: string) {
  if (normalizeTitle(title) === normalizeTitle(canonical)) return false;
  if (canonical.length < 3 || canonical.length > 42) return false;
  if (!sourceTitleSupportsCanonical(title, canonical)) return false;
  if (isConciseSourceTitle(title)) return false;
  return true;
}

function isConciseSourceTitle(title: string) {
  const normalized = normalizeTitle(title);
  if (title.length > 46) return false;
  if (/\b(sokes|soker|till|inom|for|vill du|uppdrag|langre|hostuppdrag)\b/.test(normalized)) return false;
  if (/[/:|]/.test(title)) return false;
  return true;
}

function sourceTitleSupportsCanonical(title: string, canonical: string) {
  const titleValue = normalizeTitle(title);
  const canonicalValue = normalizeTitle(canonical);
  if (titleValue.includes(canonicalValue)) return true;

  const canonicalTokens = canonicalValue.split(" ").filter((token) => token.length >= 4);
  return canonicalTokens.some((token) => titleValue.includes(token));
}
