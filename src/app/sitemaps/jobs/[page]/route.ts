import { getJobSitemapUrls, normalizeSiteUrl } from "@/lib/sitemap-data";
import { urlSetXml } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const pageNumber = Number(page.replace(/\.xml$/, ""));
  const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);
  return urlSetXml(await getJobSitemapUrls(siteUrl, pageNumber));
}
