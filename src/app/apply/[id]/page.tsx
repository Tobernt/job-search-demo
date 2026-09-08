import { notFound } from "next/navigation";
import { findJob } from "@/lib/store";
import { ApplyRedirect } from "@/components/ApplyRedirect";
import { getDisplayTitle } from "@/lib/job-title";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vidare till ansökan",
  robots: {
    index: false,
    follow: false
  }
};

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await findJob(id);

  if (!job || job.status !== "live" || job.applyLinkStatus === "failed" || !job.applyUrl) notFound();

  return <ApplyRedirect jobId={job.id} applyUrl={job.applyUrl} title={getDisplayTitle(job)} />;
}
