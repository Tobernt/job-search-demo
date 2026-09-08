import type { MetadataRoute } from "next";
import { normalizeSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/apply/", "/sponsor/", "/affiliate/", "/admin/"]
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
