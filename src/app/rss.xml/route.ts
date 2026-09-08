import { getLiveJobs } from "@/lib/store";
import { getDisplayTitle } from "@/lib/job-title";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  const jobs = (await getLiveJobs()).slice(0, 100);
  const updated = jobs[0]?.updatedAt ?? new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Job Search Demo - senaste annonser</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Svenska jobb utan dubletter, gamla annonser och säljbuller.</description>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    ${jobs.map((job) => `
    <item>
      <title>${escapeXml(getDisplayTitle(job))}</title>
      <link>${escapeXml(`${siteUrl}/jobb/${job.id}`)}</link>
      <guid>${escapeXml(job.id)}</guid>
      <pubDate>${new Date(job.publicationDate ?? job.updatedAt).toUTCString()}</pubDate>
      <description>${escapeXml(`${job.employerName} - ${job.municipality}. ${job.plainSummary}`)}</description>
    </item>`).join("")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "X-Robots-Tag": "noindex, follow"
    }
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
