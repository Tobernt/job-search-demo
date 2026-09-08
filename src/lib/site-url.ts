const fallbackSiteUrl = "https://example.invalid";

export function normalizeSiteUrl(value?: string) {
  if (!value) return fallbackSiteUrl;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return fallbackSiteUrl;
    return url.origin;
  } catch {
    return fallbackSiteUrl;
  }
}
