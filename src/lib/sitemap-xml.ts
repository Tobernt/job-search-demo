import type { SitemapSection, SitemapUrl } from "@/lib/sitemap-data";

export function sitemapIndexXml(sections: SitemapSection[]) {
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sections.map((section) => `  <sitemap>
    <loc>${escapeXml(section.url)}</loc>${lastModifiedXml(section.lastModified, 4)}
  </sitemap>`).join("\n")}
</sitemapindex>`);
}

export function urlSetXml(urls: SitemapUrl[]) {
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>${lastModifiedXml(entry.lastModified, 4)}
  </url>`).join("\n")}
</urlset>`);
}

function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=1800, s-maxage=1800"
    }
  });
}

function lastModifiedXml(value: Date | undefined, spaces: number) {
  if (!value) return "";
  return `\n${" ".repeat(spaces)}<lastmod>${value.toISOString()}</lastmod>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
