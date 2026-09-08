import { NextRequest } from "next/server";
import { getDisplayTitle } from "@/lib/job-title";
import { filterJobs, type SearchFilters } from "@/lib/search";
import { getLiveJobs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as SearchFilters & { limit?: number };
  const jobs = filterJobs(await getLiveJobs(), body).slice(0, Math.min(Math.max(Number(body.limit ?? 10), 1), 25));
  const siteUrl = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  const payload = {
    text: `Job Search Demo: ${jobs.length} nya/matchande jobb`,
    jobs: jobs.map((job) => ({
      title: getDisplayTitle(job),
      employer: job.employerName,
      location: job.municipality,
      workMode: job.workMode,
      apply: `${siteUrl}/apply/${job.id}`,
      details: `${siteUrl}/jobb/${job.id}`
    }))
  };

  if (!webhookUrl) {
    return Response.json({
      ok: false,
      message: "Set ALERT_WEBHOOK_URL to deliver this alert to Slack, Discord, Telegram bridge, or another webhook receiver.",
      preview: payload
    });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  return Response.json({ ok: response.ok, status: response.status, delivered: jobs.length });
}
