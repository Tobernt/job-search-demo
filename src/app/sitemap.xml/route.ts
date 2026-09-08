import { getSitemapSections, normalizeSiteUrl } from "@/lib/sitemap-data";
import { sitemapIndexXml } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);
  return sitemapIndexXml(await getSitemapSections(siteUrl));
}
