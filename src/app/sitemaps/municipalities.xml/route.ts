import { getMunicipalitySitemapUrls, normalizeSiteUrl } from "@/lib/sitemap-data";
import { urlSetXml } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);
  return urlSetXml(await getMunicipalitySitemapUrls(siteUrl));
}
